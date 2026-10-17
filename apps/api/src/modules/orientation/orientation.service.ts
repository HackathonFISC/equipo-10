import { createHash, randomUUID } from "node:crypto";
import { AppError } from "../../errors";
import type { VerifiedIdentity } from "../../security/auth";
import type {
  CounselorSummaryView,
  CreateOrientationEngagementRequest,
  RevokeOrientationEngagementRequest,
  CreateClarificationRequest,
  RespondClarificationRequest,
  CreateOrientationReviewRequest,
  ClarificationItemView,
  OrientationReviewView,
  OrientationEngagementView,
  CounselorInboxItemView,
  CounselorEngagementDetailView,
  LearningPlanView,
} from "@equipo10/contracts";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";

export interface OrientationDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export class OrientationService {
  constructor(private readonly db: OrientationDatabase) {}

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  private mapCounselorSummary(c: { id: string; userId: string; displayName: string; specialty: string }): CounselorSummaryView {
    return {
      id: c.id,
      user_id: c.userId,
      display_name: c.displayName,
      specialties: c.specialty ? [c.specialty] : [],
    };
  }

  // 1. Listar orientadores habilitados activos (para que el joven elija)
  async listAvailableCounselors(identity: VerifiedIdentity): Promise<CounselorSummaryView[]> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const counselors = await tx.orientationCounselor.findMany({
        where: { active: true },
        select: {
          id: true,
          userId: true,
          displayName: true,
          specialty: true,
        },
        orderBy: { displayName: "asc" },
      });
      return counselors.map((c) => this.mapCounselorSummary(c));
    });
  }

  // 2. Joven solicita acompañamiento para una versión concreta del plan
  async requestOrientation(
    identity: VerifiedIdentity,
    planId: string,
    body: CreateOrientationEngagementRequest,
    idempotencyKey?: string
  ): Promise<{ engagement: OrientationEngagementView; isReplay: boolean }> {
    const actorUserId = await this.resolveActor(identity);
    const normalizedKey = idempotencyKey?.trim() || undefined;

    const payloadHash = normalizedKey
      ? createHash("sha256")
          .update(JSON.stringify({ plan_id: planId, counselor_id: body.counselor_id, purpose: body.purpose ?? null }))
          .digest("hex")
      : undefined;

    // Verificar si ya existe recibo idempotente
    if (normalizedKey && payloadHash) {
      const existingReceipt = await this.db.withActor(actorUserId, async (tx) => {
        return tx.operationReceipt.findFirst({
          where: {
            actorUserId,
            operation: "ORIENTATION_REQUEST",
            idempotencyKey: normalizedKey,
          },
        });
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash === payloadHash) {
          return {
            engagement: existingReceipt.receiptPayload as unknown as OrientationEngagementView,
            isReplay: true,
          };
        } else {
          throw new AppError(409, "IDEMPOTENCY_CONFLICT", "La clave de idempotencia ya fue utilizada con parámetros diferentes");
        }
      }
    }

    return this.db.withActor(actorUserId, async (tx) => {
      // Validar perfil confirmado
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
        include: { currentVersion: true },
      });
      if (!profile || !profile.currentVersion) {
        throw new AppError(412, "PROFILE_NOT_CONFIRMED", "Debes tener un perfil confirmado para solicitar orientación");
      }

      // Validar orientador
      const counselor = await tx.orientationCounselor.findUnique({
        where: { id: body.counselor_id, active: true },
      });
      if (!counselor) {
        throw new AppError(404, "COUNSELOR_NOT_FOUND", "El orientador seleccionado no existe o no se encuentra activo");
      }

      // Validar plan de aprendizaje
      const plan = await tx.learningPlan.findFirst({
        where: { id: planId, profileId: profile.id },
      });
      if (!plan) {
        throw new AppError(404, "PLAN_NOT_FOUND", "El plan de aprendizaje solicitado no existe o no pertenece a tu perfil");
      }

      // Verificar si ya hay una solicitud activa no revocada para este mismo orientador y plan
      const existingActive = await tx.orientationEngagement.findFirst({
        where: {
          candidateProfileId: profile.id,
          counselorId: counselor.id,
          planId: plan.id,
          status: { notIn: ["REVOKED", "REJECTED"] },
        },
      });
      if (existingActive) {
        throw new AppError(409, "ENGAGEMENT_ALREADY_ACTIVE", "Ya existe una solicitud de acompañamiento en curso con este orientador para este plan");
      }

      // Generar recibo oficial
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randStr = randomUUID().replace(/-/g, "").substring(0, 6).toUpperCase();
      const receiptNumber = `REC-ORI-${dateStr}-${randStr}`;

      let targetOpportunityVersion: number | null = null;
      if (plan.targetOpportunityId) {
        const opp = await tx.opportunity.findUnique({
          where: { id: plan.targetOpportunityId },
          select: { version: true },
        });
        targetOpportunityVersion = opp?.version ?? null;
      }

      const engagement = await tx.orientationEngagement.create({
        data: {
          id: randomUUID(),
          candidateProfileId: profile.id,
          counselorId: counselor.id,
          planId: plan.id,
          planVersion: plan.version,
          revisionId: profile.currentVersion.id,
          targetOpportunityId: plan.targetOpportunityId,
          targetOpportunityVersion,
          purpose: body.purpose || null,
          status: "REQUESTED",
          receiptNumber,
        },
      });

      const engagementView: OrientationEngagementView = {
        id: engagement.id,
        plan_id: engagement.planId,
        plan_version: engagement.planVersion,
        candidate_profile_id: engagement.candidateProfileId,
        counselor: this.mapCounselorSummary(counselor),
        purpose: engagement.purpose,
        status: "REQUESTED",
        status_reason: null,
        requested_at: engagement.requestedAt.toISOString(),
        responded_at: null,
        revoked_at: null,
        revocation_reason: null,
        receipt_number: engagement.receiptNumber,
        reviews: [],
        clarifications: [],
      };

      let receiptRow: { id: string } | null = null;
      if (normalizedKey && payloadHash) {
        receiptRow = await tx.operationReceipt.create({
          data: {
            id: randomUUID(),
            actorUserId,
            profileId: profile.id,
            operation: "ORIENTATION_REQUEST",
            idempotencyKey: normalizedKey,
            payloadHash,
            receiptPayload: engagementView as any,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile.id,
          revisionId: profile.currentVersion.id,
          operationId: receiptRow ? receiptRow.id : null,
          caseId: "CU14",
          event: "ORIENTATION_REQUEST_CREATED",
          reasonCode: "YOUTH_REQUESTED_ORIENTATION",
        },
      });

      return { engagement: engagementView, isReplay: false };
    });
  }

  // 3. Consultar acompañamientos para un plan concreto desde el lado del joven
  async listCandidateEngagements(identity: VerifiedIdentity, planId: string): Promise<OrientationEngagementView[]> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
      });
      if (!profile) return [];

      const engagements = await tx.orientationEngagement.findMany({
        where: {
          candidateProfileId: profile.id,
          planId,
        },
        include: {
          counselor: true,
          reviews: {
            include: { counselorUser: true },
            orderBy: { reviewedAt: "desc" },
          },
          clarifications: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { requestedAt: "desc" },
      });

      return engagements.map((e) => ({
        id: e.id,
        plan_id: e.planId,
        plan_version: e.planVersion,
        candidate_profile_id: e.candidateProfileId,
        counselor: this.mapCounselorSummary(e.counselor),
        purpose: e.purpose,
        status: e.status as any,
        status_reason: e.statusReason,
        requested_at: e.requestedAt.toISOString(),
        responded_at: e.respondedAt ? e.respondedAt.toISOString() : null,
        revoked_at: e.revokedAt ? e.revokedAt.toISOString() : null,
        revocation_reason: e.revocationReason,
        receipt_number: e.receiptNumber,
        reviews: e.reviews.map((r) => ({
          id: r.id,
          engagement_id: r.engagementId,
          counselor_user_id: r.counselorUserId,
          counselor_name: e.counselor.displayName,
          plan_id: r.planId,
          plan_version: r.planVersion,
          revision_id: r.revisionId,
          decision: r.decision as any,
          motivation: r.motivation,
          reasons: (r.reasons as string[]) || [],
          reviewed_at: r.reviewedAt.toISOString(),
        })),
        clarifications: e.clarifications.map((cl) => ({
          id: cl.id,
          engagement_id: cl.engagementId,
          question: cl.question,
          proposed_correction: cl.proposedCorrection,
          youth_decision: cl.youthDecision as any,
          youth_response: cl.youthResponse,
          created_at: cl.createdAt.toISOString(),
          responded_at: cl.respondedAt ? cl.respondedAt.toISOString() : null,
        })),
      }));
    });
  }

  // 4. Joven revoca el acompañamiento (corta de inmediato el acceso al orientador)
  async revokeOrientation(
    identity: VerifiedIdentity,
    engagementId: string,
    body: RevokeOrientationEngagementRequest,
    idempotencyKey?: string
  ): Promise<OrientationEngagementView> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
      });
      if (!profile) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Perfil no encontrado");
      }

      const engagement = await tx.orientationEngagement.findFirst({
        where: { id: engagementId, candidateProfileId: profile.id },
        include: { counselor: true },
      });
      if (!engagement) {
        throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "Acompañamiento no encontrado");
      }

      // Si ya estaba revocado, es idempotente
      if (engagement.status === "REVOKED") {
        return {
          id: engagement.id,
          plan_id: engagement.planId,
          plan_version: engagement.planVersion,
          candidate_profile_id: engagement.candidateProfileId,
          counselor: this.mapCounselorSummary(engagement.counselor),
          purpose: engagement.purpose,
          status: "REVOKED",
          status_reason: engagement.statusReason,
          requested_at: engagement.requestedAt.toISOString(),
          responded_at: engagement.respondedAt ? engagement.respondedAt.toISOString() : null,
          revoked_at: engagement.revokedAt ? engagement.revokedAt.toISOString() : null,
          revocation_reason: engagement.revocationReason,
          receipt_number: engagement.receiptNumber,
        };
      }

      const updated = await tx.orientationEngagement.update({
        where: { id: engagement.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          revocationReason: body.reason || "Revocado por decisión del joven",
        },
        include: { counselor: true },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile.id,
          revisionId: updated.revisionId,
          operationId: null,
          caseId: "CU14",
          event: "ORIENTATION_REVOKED",
          reasonCode: "YOUTH_REVOKED_CONSENT",
        },
      });

      return {
        id: updated.id,
        plan_id: updated.planId,
        plan_version: updated.planVersion,
        candidate_profile_id: updated.candidateProfileId,
        counselor: this.mapCounselorSummary(updated.counselor),
        purpose: updated.purpose,
        status: "REVOKED",
        status_reason: updated.statusReason,
        requested_at: updated.requestedAt.toISOString(),
        responded_at: updated.respondedAt ? updated.respondedAt.toISOString() : null,
        revoked_at: updated.revokedAt ? updated.revokedAt.toISOString() : null,
        revocation_reason: updated.revocationReason,
        receipt_number: updated.receiptNumber,
      };
    });
  }

  // 5. Joven responde a una propuesta de aclaración/corrección del orientador
  async respondClarification(
    identity: VerifiedIdentity,
    engagementId: string,
    clarificationId: string,
    body: RespondClarificationRequest
  ): Promise<ClarificationItemView> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
      });
      if (!profile) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Perfil no encontrado");
      }

      const engagement = await tx.orientationEngagement.findFirst({
        where: { id: engagementId, candidateProfileId: profile.id },
      });
      if (!engagement) {
        throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "Acompañamiento no encontrado");
      }
      if (engagement.status === "REVOKED") {
        throw new AppError(403, "ENGAGEMENT_REVOKED", "No es posible interactuar con un acompañamiento revocado");
      }

      const clarification = await tx.orientationClarification.findFirst({
        where: { id: clarificationId, engagementId: engagement.id },
      });
      if (!clarification) {
        throw new AppError(404, "CLARIFICATION_NOT_FOUND", "Aclaración no encontrada");
      }

      const updated = await tx.orientationClarification.update({
        where: { id: clarification.id },
        data: {
          youthDecision: body.decision,
          youthResponse: body.response || null,
          respondedAt: new Date(),
        },
      });

      // Si estaba en CLARIFICATION_REQUESTED, vuelve a IN_REVIEW
      if (engagement.status === "CLARIFICATION_REQUESTED") {
        await tx.orientationEngagement.update({
          where: { id: engagement.id },
          data: { status: "IN_REVIEW" },
        });
      }

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile.id,
          revisionId: engagement.revisionId,
          operationId: null,
          caseId: "CU14",
          event: "ORIENTATION_CLARIFICATION_RESPONDED",
          reasonCode: body.decision === "ACCEPTED" ? "YOUTH_ACCEPTED_CLARIFICATION" : "YOUTH_REJECTED_CLARIFICATION",
        },
      });

      return {
        id: updated.id,
        engagement_id: updated.engagementId,
        question: updated.question,
        proposed_correction: updated.proposedCorrection,
        youth_decision: updated.youthDecision as any,
        youth_response: updated.youthResponse,
        created_at: updated.createdAt.toISOString(),
        responded_at: updated.respondedAt ? updated.respondedAt.toISOString() : null,
      };
    });
  }

  // 6. Orientador: Bandeja de entrada con solicitudes asignadas
  async listCounselorInbox(identity: VerifiedIdentity): Promise<CounselorInboxItemView[]> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const counselor = await tx.orientationCounselor.findUnique({
        where: { userId: actorUserId, active: true },
      });
      if (!counselor) {
        throw new AppError(403, "NOT_A_COUNSELOR", "El usuario no está habilitado como orientador independiente");
      }

      const engagements = await tx.orientationEngagement.findMany({
        where: {
          counselorId: counselor.id,
          status: { not: "REVOKED" },
        },
        include: {
          candidateProfile: {
            include: {
              currentVersion: {
                select: {
                  experiences: { take: 1 },
                },
              },
            },
          },
          plan: {
            include: {
              targetOpportunity: { select: { title: true } },
            },
          },
          clarifications: { select: { id: true } },
        },
        orderBy: { requestedAt: "desc" },
      });

      return engagements.map((e) => ({
        id: e.id,
        candidate_name: `Candidato #${e.candidateProfileId.substring(0, 8)}`,
        target_opportunity_title: e.plan?.targetOpportunity?.title || "Ruta de Empleabilidad General",
        plan_id: e.planId,
        plan_version: e.planVersion,
        status: e.status as any,
        requested_at: e.requestedAt.toISOString(),
        clarifications_count: e.clarifications.length,
      }));
    });
  }

  // 7. Orientador: Detalle completo de la ruta autorizada
  async getCounselorEngagementDetail(
    identity: VerifiedIdentity,
    engagementId: string
  ): Promise<CounselorEngagementDetailView> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const counselor = await tx.orientationCounselor.findUnique({
        where: { userId: actorUserId, active: true },
      });
      if (!counselor) {
        throw new AppError(403, "NOT_A_COUNSELOR", "El usuario no está habilitado como orientador independiente");
      }

      const engagement = await tx.orientationEngagement.findFirst({
        where: { id: engagementId, counselorId: counselor.id },
        include: {
          candidateProfile: {
            include: {
              currentVersion: {
                include: {
                  constraints: true,
                },
              },
            },
          },
          plan: {
            include: {
              targetOpportunity: {
                include: { organization: { select: { name: true } } },
              },
              steps: {
                orderBy: { stepOrder: "asc" },
                include: {
                  edition: {
                    include: { courseVersion: { include: { course: true } } },
                  },
                },
              },
              explanations: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
          reviews: {
            include: { counselorUser: true },
            orderBy: { reviewedAt: "desc" },
          },
          clarifications: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!engagement || engagement.status === "REVOKED") {
        throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "Solicitud de acompañamiento no encontrada o revocada por el candidato");
      }

      // Si el plan cambió de versión respecto a la solicitada, marcar como desactualizado
      let effectiveStatus = engagement.status;
      if (engagement.plan.version !== engagement.planVersion) {
        effectiveStatus = "OUTDATED";
      }

      const rev = engagement.candidateProfile?.currentVersion;
      const targetOpp = engagement.plan.targetOpportunity;

      const planView: LearningPlanView = {
        id: engagement.plan.id,
        target_opportunity_id: engagement.plan.targetOpportunityId,
        target_occupation_id: engagement.plan.targetOccupationId,
        status: engagement.plan.status as any,
        feasibility: engagement.plan.feasibility as any,
        coverage_numerator: engagement.plan.coverageNumerator,
        coverage_denominator: engagement.plan.coverageDenominator,
        total_cost_amount: engagement.plan.totalCostAmount ? engagement.plan.totalCostAmount.toFixed(2) : null,
        currency: engagement.plan.currency,
        residual_gap: engagement.plan.residualGap || [],
        reasons: engagement.plan.reasons || [],
        outdated: engagement.plan.outdated,
        version: engagement.plan.version,
        created_at: engagement.plan.createdAt.toISOString(),
        steps: engagement.plan.steps.map((s) => ({
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
      };

      return {
        engagement: {
          id: engagement.id,
          plan_id: engagement.planId,
          plan_version: engagement.planVersion,
          candidate_profile_id: engagement.candidateProfileId,
          counselor: this.mapCounselorSummary(counselor),
          purpose: engagement.purpose,
          status: effectiveStatus as any,
          status_reason: engagement.statusReason,
          requested_at: engagement.requestedAt.toISOString(),
          responded_at: engagement.respondedAt ? engagement.respondedAt.toISOString() : null,
          revoked_at: engagement.revokedAt ? engagement.revokedAt.toISOString() : null,
          revocation_reason: engagement.revocationReason,
          receipt_number: engagement.receiptNumber,
          reviews: engagement.reviews.map((r) => ({
            id: r.id,
            engagement_id: r.engagementId,
            counselor_user_id: r.counselorUserId,
            counselor_name: counselor.displayName,
            plan_id: r.planId,
            plan_version: r.planVersion,
            revision_id: r.revisionId,
            decision: r.decision as any,
            motivation: r.motivation,
            reasons: (r.reasons as string[]) || [],
            reviewed_at: r.reviewedAt.toISOString(),
          })),
          clarifications: engagement.clarifications.map((cl) => ({
            id: cl.id,
            engagement_id: cl.engagementId,
            question: cl.question,
            proposed_correction: cl.proposedCorrection,
            youth_decision: cl.youthDecision as any,
            youth_response: cl.youthResponse,
            created_at: cl.createdAt.toISOString(),
            responded_at: cl.respondedAt ? cl.respondedAt.toISOString() : null,
          })),
        },
        candidate_summary: {
          display_name: `Candidato #${engagement.candidateProfileId.substring(0, 8)}`,
          headline: "Perfil Confirmado Oficial",
          max_commute_minutes: rev?.constraints?.maxOneWayMinutes ?? null,
          training_budget: rev?.constraints?.trainingBudget ? rev.constraints.trainingBudget.toFixed(2) : null,
        },
        target_opportunity: targetOpp
          ? {
              id: targetOpp.id,
              title: targetOpp.title,
              organization_name: targetOpp.organization.name,
              workplace_type: targetOpp.workplaceType as any,
              location: targetOpp.location,
            }
          : null,
        plan: planView,
        explanations: engagement.plan.explanations.map((exp) => ({
          summary: exp.summary,
          reasons: (((exp.decisionJson as any)?.reasons || []) as string[]),
          created_at: exp.createdAt.toISOString(),
        })),
        reviews: engagement.reviews.map((r) => ({
          id: r.id,
          engagement_id: r.engagementId,
          counselor_user_id: r.counselorUserId,
          counselor_name: counselor.displayName,
          plan_id: r.planId,
          plan_version: r.planVersion,
          revision_id: r.revisionId,
          decision: r.decision as any,
          motivation: r.motivation,
          reasons: (r.reasons as string[]) || [],
          reviewed_at: r.reviewedAt.toISOString(),
        })),
        clarifications: engagement.clarifications.map((cl) => ({
          id: cl.id,
          engagement_id: cl.engagementId,
          question: cl.question,
          proposed_correction: cl.proposedCorrection,
          youth_decision: cl.youthDecision as any,
          youth_response: cl.youthResponse,
          created_at: cl.createdAt.toISOString(),
          responded_at: cl.respondedAt ? cl.respondedAt.toISOString() : null,
        })),
      };
    });
  }

  // 8. Orientador: Proponer aclaración o corrección
  async createClarification(
    identity: VerifiedIdentity,
    engagementId: string,
    body: CreateClarificationRequest
  ): Promise<ClarificationItemView> {
    const actorUserId = await this.resolveActor(identity);
    return this.db.withActor(actorUserId, async (tx) => {
      const counselor = await tx.orientationCounselor.findUnique({
        where: { userId: actorUserId, active: true },
      });
      if (!counselor) {
        throw new AppError(403, "NOT_A_COUNSELOR", "El usuario no está habilitado como orientador independiente");
      }

      const engagement = await tx.orientationEngagement.findFirst({
        where: { id: engagementId, counselorId: counselor.id },
      });
      if (!engagement || engagement.status === "REVOKED") {
        throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "Acompañamiento no encontrado o revocado");
      }

      const clarification = await tx.orientationClarification.create({
        data: {
          id: randomUUID(),
          engagementId: engagement.id,
          question: body.question,
          proposedCorrection: body.proposed_correction || null,
          youthDecision: "PENDING",
        },
      });

      await tx.orientationEngagement.update({
        where: { id: engagement.id },
        data: { status: "CLARIFICATION_REQUESTED" },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: null,
          revisionId: null,
          operationId: null,
          caseId: engagement.id,
          event: "ORIENTATION_CLARIFICATION_PROPOSED",
          reasonCode: "COUNSELOR_PROPOSED_CLARIFICATION",
        },
      });

      return {
        id: clarification.id,
        engagement_id: clarification.engagementId,
        question: clarification.question,
        proposed_correction: clarification.proposedCorrection,
        youth_decision: "PENDING",
        youth_response: null,
        created_at: clarification.createdAt.toISOString(),
        responded_at: null,
      };
    });
  }

  // 9. Orientador: Emitir revisión motivada (APROBADA o RECHAZADA)
  async submitReview(
    identity: VerifiedIdentity,
    engagementId: string,
    body: CreateOrientationReviewRequest,
    idempotencyKey?: string
  ): Promise<{ review: OrientationReviewView; isReplay: boolean }> {
    const actorUserId = await this.resolveActor(identity);
    const normalizedKey = idempotencyKey?.trim() || undefined;

    const payloadHash = normalizedKey
      ? createHash("sha256")
          .update(
            JSON.stringify({
              engagementId,
              expected_plan_version: body.expected_plan_version,
              decision: body.decision,
              motivation: body.motivation,
              reasons: body.reasons || [],
            })
          )
          .digest("hex")
      : undefined;

    // Verificar si ya existe recibo idempotente
    if (normalizedKey && payloadHash) {
      const existingReceipt = await this.db.withActor(actorUserId, async (tx) => {
        return tx.operationReceipt.findFirst({
          where: {
            actorUserId,
            operation: "ORIENTATION_REVIEW",
            idempotencyKey: normalizedKey,
          },
        });
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash === payloadHash) {
          // Revalidar permisos antes de devolver el replay
          await this.db.withActor(actorUserId, async (tx) => {
            const counselor = await tx.orientationCounselor.findUnique({
              where: { userId: actorUserId, active: true },
            });
            if (!counselor) {
              throw new AppError(403, "NOT_A_COUNSELOR", "El usuario no está habilitado como orientador");
            }
            const eng = await tx.orientationEngagement.findFirst({
              where: { id: engagementId, counselorId: counselor.id },
            });
            if (!eng || eng.status === "REVOKED") {
              throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "Acompañamiento no encontrado o revocado");
            }
          });
          return {
            review: existingReceipt.receiptPayload as unknown as OrientationReviewView,
            isReplay: true,
          };
        } else {
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "La clave de idempotencia ya fue utilizada con parámetros diferentes"
          );
        }
      }
    }

    return this.db.withActor(actorUserId, async (tx) => {
      const counselor = await tx.orientationCounselor.findUnique({
        where: { userId: actorUserId, active: true },
      });
      if (!counselor) {
        throw new AppError(403, "NOT_A_COUNSELOR", "El usuario no está habilitado como orientador independiente");
      }

      const engagement = await tx.orientationEngagement.findFirst({
        where: { id: engagementId, counselorId: counselor.id },
        include: {
          plan: {
            include: {
              steps: {
                include: {
                  edition: {
                    include: { courseVersion: { include: { course: true } } },
                  },
                },
              },
            },
          },
          candidateProfile: true,
        },
      });

      if (!engagement || engagement.status === "REVOKED") {
        throw new AppError(404, "ENGAGEMENT_NOT_FOUND", "Acompañamiento no encontrado o revocado por el candidato");
      }

      // Prevenir duplicados si ya cuenta con revisión
      if (engagement.status === "APPROVED" || engagement.status === "REJECTED") {
        const previousReview = await tx.orientationReview.findFirst({
          where: { engagementId: engagement.id },
        });
        if (previousReview) {
          throw new AppError(409, "ENGAGEMENT_ALREADY_REVIEWED", "Este acompañamiento ya cuenta con una revisión registrada");
        }
      }

      // 1. Validación estricta de versión de plan
      if (engagement.plan.version !== body.expected_plan_version || engagement.plan.version !== engagement.planVersion) {
        throw new AppError(
          409,
          "OUTDATED_PLAN_VERSION",
          "La versión del plan ha cambiado; no se puede registrar una revisión sobre una versión obsoleta"
        );
      }

      // 2. Estado del plan y bandera outdated
      if (engagement.plan.outdated) {
        throw new AppError(409, "OUTDATED_PLAN_VERSION", "El plan de aprendizaje está marcado como desactualizado");
      }
      if (engagement.plan.status !== "CONFIRMED") {
        throw new AppError(409, "OUTDATED_PLAN_VERSION", "El plan de aprendizaje debe estar confirmado para ser revisado");
      }

      // 3. Revalidar vacante objetivo si el plan tiene una asignada
      if (engagement.targetOpportunityId) {
        const currentOpp = await tx.opportunity.findUnique({
          where: { id: engagement.targetOpportunityId },
          select: { version: true, active: true },
        });
        if (
          !currentOpp ||
          !currentOpp.active ||
          (engagement.targetOpportunityVersion !== null && currentOpp.version !== engagement.targetOpportunityVersion)
        ) {
          throw new AppError(
            409,
            "OUTDATED_PLAN_VERSION",
            "La vacante u oportunidad objetivo asociada al plan ha cambiado de versión o ya no está disponible"
          );
        }
      }

      // 4. Revalidar ediciones formativas del plan
      for (const step of engagement.plan.steps) {
        if (!step.edition.active || !step.edition.courseVersion.course.active) {
          throw new AppError(409, "OUTDATED_PLAN_VERSION", "Una de las ediciones formativas o cursos del plan ya no está disponible");
        }
        if (new Date(step.edition.startDate).getTime() < Date.now()) {
          throw new AppError(409, "OUTDATED_PLAN_VERSION", "Una de las ediciones formativas del plan ya ha comenzado o ha expirado");
        }
      }

      // 5. Revalidar versión confirmada del perfil del joven
      if (engagement.candidateProfile.currentVersionId !== engagement.revisionId) {
        throw new AppError(
          409,
          "OUTDATED_PLAN_VERSION",
          "El perfil confirmado del joven ha cambiado de versión desde la solicitud de orientación"
        );
      }

      // 6. Reglas deterministas C01 para aprobación:
      if (body.decision === "APPROVED") {
        // Bloquear condiciones esenciales desconocidas (PENDING)
        if (engagement.plan.feasibility === "PENDING") {
          throw new AppError(
            409,
            "CANNOT_APPROVE_PENDING_PLAN",
            "No se puede aprobar un plan con condiciones esenciales desconocidas (PENDING). Se requiere aclaración previa de horarios o traslados."
          );
        }
        // Bloquear incompatibilidades inviables (INVIABLE)
        if (engagement.plan.feasibility === "INVIABLE") {
          throw new AppError(
            409,
            "CANNOT_APPROVE_INVIABLE_PLAN",
            "No se puede emitir una revisión aprobada sobre un plan que contiene incompatibilidades inviables según el cálculo determinista C01"
          );
        }
      }

      const review = await tx.orientationReview.create({
        data: {
          id: randomUUID(),
          engagementId: engagement.id,
          counselorUserId: actorUserId,
          planId: engagement.planId,
          planVersion: engagement.planVersion,
          revisionId: engagement.revisionId,
          decision: body.decision,
          motivation: body.motivation,
          reasons: body.reasons || [],
        },
      });

      const nextStatus =
        body.decision === "APPROVED"
          ? "APPROVED"
          : body.decision === "REJECTED"
          ? "REJECTED"
          : "CLARIFICATION_REQUESTED";

      await tx.orientationEngagement.update({
        where: { id: engagement.id },
        data: {
          status: nextStatus,
          statusReason: body.motivation,
          respondedAt: new Date(),
        },
      });

      const reviewView: OrientationReviewView = {
        id: review.id,
        engagement_id: review.engagementId,
        counselor_user_id: review.counselorUserId,
        counselor_name: counselor.displayName,
        plan_id: review.planId,
        plan_version: review.planVersion,
        revision_id: review.revisionId,
        decision: review.decision as any,
        motivation: review.motivation,
        reasons: (review.reasons as string[]) || [],
        reviewed_at: review.reviewedAt.toISOString(),
      };

      let receiptRow: { id: string } | null = null;
      if (normalizedKey && payloadHash) {
        receiptRow = await tx.operationReceipt.create({
          data: {
            id: randomUUID(),
            actorUserId,
            profileId: null,
            operation: "ORIENTATION_REVIEW",
            idempotencyKey: normalizedKey,
            payloadHash,
            receiptPayload: reviewView as any,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: null,
          revisionId: null,
          operationId: receiptRow ? receiptRow.id : null,
          caseId: engagement.id,
          event: "ORIENTATION_REVIEW_SUBMITTED",
          reasonCode:
            body.decision === "APPROVED"
              ? "COUNSELOR_APPROVED"
              : body.decision === "REJECTED"
              ? "COUNSELOR_REJECTED"
              : "COUNSELOR_CLARIFICATION_NEEDED",
        },
      });

      return { review: reviewView, isReplay: false };
    });
  }
}
