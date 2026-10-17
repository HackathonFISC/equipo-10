import { randomUUID } from "node:crypto";
import type { VerifiedIdentity } from "../../security/auth";
import { AppError } from "../../errors";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";
import type {
  LearningPlanView,
  LearningPlanPreviewRequest,
  LearningPlanExplanationView,
  PlanFeasibility,
  PlanStepType,
} from "@equipo10/contracts";
import {
  calculateLearningRouteC01,
  type CandidatePlannerProfile,
  type TargetRequirement,
  type PlannerCourseEdition,
} from "./c01-planner";
import type { IAgentA05Service } from "./agent-a05.service";

export interface PlanningDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export class PlanningService {
  constructor(
    private readonly db: PlanningDatabase,
    private readonly agentA05: IAgentA05Service
  ) {}

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  async previewPlan(
    identity: VerifiedIdentity,
    request: LearningPlanPreviewRequest
  ): Promise<LearningPlanView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      // 1. Obtener perfil confirmado del candidato
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
        include: {
          currentVersion: {
            include: {
              claims: {
                where: { decision: "ACCEPTED" },
                include: { evidenceLinks: true },
              },
              constraints: true,
              windows: true,
            },
          },
          courseReservations: {
            where: { status: "CONFIRMED" },
            include: { edition: { include: { sessions: true } } },
          },
        },
      });

      if (!profile || !profile.currentVersion) {
        throw new AppError(409, "PROFILE_NOT_CONFIRMED", "Debes tener un perfil confirmado para calcular planes formativos");
      }

      const rev = profile.currentVersion;

      const candidatePlanner: CandidatePlannerProfile = {
        id: actorUserId,
        profileId: profile.id,
        revisionId: rev.id,
        claims: rev.claims.map((c) => ({
          competencyId: c.competencyId,
          decision: c.decision,
          hasEvidence: c.evidenceLinks.length > 0,
        })),
        trainingBudget: rev.constraints?.trainingBudget ? Number(rev.constraints.trainingBudget) : null,
        transportBudget: rev.constraints?.transportBudget ? Number(rev.constraints.transportBudget) : null,
        availabilityWindows: rev.windows.map((w) => ({
          weekday: w.weekday,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        })),
        activeReservations: profile.courseReservations.map((r) => ({
          editionId: r.editionId,
          startDate: r.edition.startDate,
          endDate: r.edition.endDate,
          sessions: r.edition.sessions.map((s) => ({
            weekday: s.weekday,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
          })),
        })),
      };

      // 2. Extraer requerimientos meta (vacante u ocupación)
      let targetRequirements: TargetRequirement[] = [];

      if (request.target_opportunity_id) {
        const opp = await tx.opportunity.findUnique({
          where: { id: request.target_opportunity_id },
          include: {
            requirements: {
              include: { competency: true },
            },
          },
        });
        if (!opp) {
          throw new AppError(404, "OPPORTUNITY_NOT_FOUND", "Oportunidad meta no encontrada");
        }
        targetRequirements = opp.requirements.map((r) => ({
          id: r.id,
          competencyId: r.competencyId,
          competencyName: r.competency?.name || "Competencia",
          competencyCode: r.competency?.code,
          essential: r.requirementType === "ESSENTIAL",
        }));
      }

      // 3. Buscar ediciones en catálogo dentro de horizonte (30 días por defecto)
      const now = new Date();
      const horizonDays = request.assumptions?.horizon_days || 30;
      const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

      const editionsData = await tx.courseEdition.findMany({
        where: {
          active: true,
          startDate: { gte: now, lte: horizonEnd },
        },
        include: {
          courseVersion: {
            include: {
              course: { select: { title: true, code: true } },
              learningOutcomes: { include: { competency: true } },
              prerequisites: { include: { competency: true } },
            },
          },
          sessions: true,
          reservations: { where: { status: "CONFIRMED" }, select: { id: true } },
        },
      });

      const plannerEditions: PlannerCourseEdition[] = editionsData.map((ed) => {
        const availableSlots = Math.max(0, ed.totalSlots - ed.reservations.length);
        return {
          id: ed.id,
          courseId: ed.courseVersion.courseId,
          courseTitle: ed.courseVersion.course.title,
          code: ed.courseVersion.course.code,
          startDate: ed.startDate,
          endDate: ed.endDate,
          totalSlots: ed.totalSlots,
          availableSlots,
          costAmount: ed.costAmount ? Number(ed.costAmount) : 0,
          costCurrency: ed.costCurrency || "USD",
          costPeriod: ed.costPeriod,
          scheduleSummary: ed.scheduleSummary,
          sessions: ed.sessions.map((s) => ({
            weekday: s.weekday,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
            timezone: s.timezone,
            location: s.location,
          })),
          learningOutcomes: ed.courseVersion.learningOutcomes.map((o) => ({
            competencyId: o.competencyId,
            competencyName: o.competency.name,
          })),
          prerequisites: ed.courseVersion.prerequisites.map((p) => ({
            competencyId: p.competencyId,
            competencyName: p.competency.name,
            essential: p.essential,
          })),
        };
      });

      // 4. Ejecutar cálculo determinista C01
      const c01Result = calculateLearningRouteC01(
        candidatePlanner,
        targetRequirements,
        plannerEditions,
        {
          commuteMinutes: request.assumptions?.commute_minutes,
          maxBudgetAmount: request.assumptions?.max_budget_amount
            ? Number(request.assumptions.max_budget_amount)
            : undefined,
          horizonDays,
        }
      );

      // 5. Persistir LearningPlan en estado CALCULATED
      const planId = randomUUID();
      const plan = await tx.learningPlan.create({
        data: {
          id: planId,
          profileId: profile.id,
          revisionId: rev.id,
          targetOpportunityId: request.target_opportunity_id || null,
          targetOccupationId: request.target_occupation_id || null,
          status: "CALCULATED",
          feasibility: c01Result.feasibility,
          coverageNumerator: c01Result.coverageNumerator,
          coverageDenominator: c01Result.coverageDenominator,
          totalCostAmount: c01Result.totalCostAmount ? Number(c01Result.totalCostAmount) : null,
          currency: c01Result.currency,
          residualGap: c01Result.residualGap,
          reasons: c01Result.reasons,
          assumptionsJson: (request.assumptions || {}) as any,
          version: 1,
          steps: {
            create: c01Result.steps.map((s) => ({
              id: randomUUID(),
              stepOrder: s.stepOrder,
              editionId: s.editionId,
              stepType: s.stepType,
              conditionalPrerequisiteDescription: s.conditionalPrerequisiteDescription || null,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              edition: {
                include: { courseVersion: { include: { course: true } } },
              },
            },
          },
        },
      });

      return {
        id: plan.id,
        target_opportunity_id: plan.targetOpportunityId,
        target_occupation_id: plan.targetOccupationId,
        status: plan.status as any,
        feasibility: plan.feasibility as any,
        coverage_numerator: plan.coverageNumerator,
        coverage_denominator: plan.coverageDenominator,
        total_cost_amount: plan.totalCostAmount ? plan.totalCostAmount.toFixed(2) : null,
        currency: plan.currency,
        residual_gap: plan.residualGap || [],
        reasons: plan.reasons || [],
        steps: plan.steps.map((s) => ({
          id: s.id,
          step_order: s.stepOrder,
          edition_id: s.editionId,
          course_title: s.edition.courseVersion.course.title,
          step_type: s.stepType as any,
          conditional_prerequisite_description: s.conditionalPrerequisiteDescription,
          schedule_summary: s.edition.scheduleSummary,
          cost_amount: s.edition.costAmount ? s.edition.costAmount.toFixed(2) : null,
          currency: s.edition.costCurrency,
        })),
        outdated: false,
        version: plan.version,
        confirmed_at: null,
        created_at: plan.createdAt.toISOString(),
      };
    });
  }

  async confirmPlan(
    identity: VerifiedIdentity,
    planId: string
  ): Promise<LearningPlanView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const plan = await tx.learningPlan.findFirst({
        where: { id: planId, profile: { ownerUserId: actorUserId } },
        include: {
          profile: { select: { currentVersionId: true } },
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              edition: {
                include: { courseVersion: { include: { course: true } } },
              },
            },
          },
        },
      });

      if (!plan) {
        throw new AppError(404, "PLAN_NOT_FOUND", "Plan formativo no encontrado");
      }

      // Comprobar desactualización si el perfil del candidato cambió
      const isOutdated = plan.revisionId !== plan.profile.currentVersionId;
      if (isOutdated) {
        throw new AppError(
          409,
          "PLAN_OUTDATED",
          "Tu perfil ha cambiado desde que se calculó este plan. Debes volver a calcular una vista previa antes de confirmarlo."
        );
      }

      // REGLA CRUCIAL: Confirmar el plan actualiza su estado, pero NO reserva ediciones ni descuenta plazas.
      const updated = await tx.learningPlan.update({
        where: { id: plan.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          version: plan.version + 1,
        },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              edition: {
                include: { courseVersion: { include: { course: true } } },
              },
            },
          },
        },
      });

      return {
        id: updated.id,
        target_opportunity_id: updated.targetOpportunityId,
        target_occupation_id: updated.targetOccupationId,
        status: updated.status as any,
        feasibility: updated.feasibility as any,
        coverage_numerator: updated.coverageNumerator,
        coverage_denominator: updated.coverageDenominator,
        total_cost_amount: updated.totalCostAmount ? updated.totalCostAmount.toFixed(2) : null,
        currency: updated.currency,
        residual_gap: updated.residualGap || [],
        reasons: updated.reasons || [],
        steps: updated.steps.map((s) => ({
          id: s.id,
          step_order: s.stepOrder,
          edition_id: s.editionId,
          course_title: s.edition.courseVersion.course.title,
          step_type: s.stepType as any,
          conditional_prerequisite_description: s.conditionalPrerequisiteDescription,
          schedule_summary: s.edition.scheduleSummary,
          cost_amount: s.edition.costAmount ? s.edition.costAmount.toFixed(2) : null,
          currency: s.edition.costCurrency,
        })),
        outdated: false,
        version: updated.version,
        confirmed_at: updated.confirmedAt ? updated.confirmedAt.toISOString() : null,
        created_at: updated.createdAt.toISOString(),
      };
    });
  }

  async explainPlan(
    identity: VerifiedIdentity,
    planId: string,
    consent: boolean,
    answers?: { field: string; text: string }[]
  ): Promise<LearningPlanExplanationView> {
    const actorUserId = await this.resolveActor(identity);
    const result = await this.agentA05.explainPlan({
      planId,
      actorUserId,
      consent,
      answers,
    });
    return result.explanation;
  }

  async listPlans(identity: VerifiedIdentity): Promise<LearningPlanView[]> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const plans = await tx.learningPlan.findMany({
        where: { profile: { ownerUserId: actorUserId } },
        orderBy: { createdAt: "desc" },
        include: {
          profile: { select: { currentVersionId: true } },
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              edition: {
                include: { courseVersion: { include: { course: true } } },
              },
            },
          },
        },
      });

      return plans.map((plan) => {
        const outdated = plan.revisionId !== plan.profile.currentVersionId;
        return {
          id: plan.id,
          target_opportunity_id: plan.targetOpportunityId,
          target_occupation_id: plan.targetOccupationId,
          status: plan.status as any,
          feasibility: plan.feasibility as any,
          coverage_numerator: plan.coverageNumerator,
          coverage_denominator: plan.coverageDenominator,
          total_cost_amount: plan.totalCostAmount ? plan.totalCostAmount.toFixed(2) : null,
          currency: plan.currency,
          residual_gap: plan.residualGap || [],
          reasons: plan.reasons || [],
          steps: plan.steps.map((s) => ({
            id: s.id,
            step_order: s.stepOrder,
            edition_id: s.editionId,
            course_title: s.edition.courseVersion.course.title,
            step_type: s.stepType as any,
            conditional_prerequisite_description: s.conditionalPrerequisiteDescription,
            schedule_summary: s.edition.scheduleSummary,
            cost_amount: s.edition.costAmount ? s.edition.costAmount.toFixed(2) : null,
            currency: s.edition.costCurrency,
          })),
          outdated,
          version: plan.version,
          confirmed_at: plan.confirmedAt ? plan.confirmedAt.toISOString() : null,
          created_at: plan.createdAt.toISOString(),
        };
      });
    });
  }

  async getPlanDetail(
    identity: VerifiedIdentity,
    planId: string
  ): Promise<LearningPlanView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const plan = await tx.learningPlan.findFirst({
        where: { id: planId, profile: { ownerUserId: actorUserId } },
        include: {
          profile: { select: { currentVersionId: true } },
          steps: {
            orderBy: { stepOrder: "asc" },
            include: {
              edition: {
                include: { courseVersion: { include: { course: true } } },
              },
            },
          },
        },
      });

      if (!plan) {
        throw new AppError(404, "PLAN_NOT_FOUND", "Plan formativo no encontrado");
      }

      const outdated = plan.revisionId !== plan.profile.currentVersionId;

      return {
        id: plan.id,
        target_opportunity_id: plan.targetOpportunityId,
        target_occupation_id: plan.targetOccupationId,
        status: plan.status as any,
        feasibility: plan.feasibility as any,
        coverage_numerator: plan.coverageNumerator,
        coverage_denominator: plan.coverageDenominator,
        total_cost_amount: plan.totalCostAmount ? plan.totalCostAmount.toFixed(2) : null,
        currency: plan.currency,
        residual_gap: plan.residualGap || [],
        reasons: plan.reasons || [],
        steps: plan.steps.map((s) => ({
          id: s.id,
          step_order: s.stepOrder,
          edition_id: s.editionId,
          course_title: s.edition.courseVersion.course.title,
          step_type: s.stepType as any,
          conditional_prerequisite_description: s.conditionalPrerequisiteDescription,
          schedule_summary: s.edition.scheduleSummary,
          cost_amount: s.edition.costAmount ? s.edition.costAmount.toFixed(2) : null,
          currency: s.edition.costCurrency,
        })),
        outdated,
        version: plan.version,
        confirmed_at: plan.confirmedAt ? plan.confirmedAt.toISOString() : null,
        created_at: plan.createdAt.toISOString(),
      };
    });
  }
}
