import { createHash, randomUUID } from "node:crypto";
import type { Database } from "../../infrastructure/database";
import { AppError } from "../../errors";
import type { VerifiedIdentity } from "../../security/auth";
import type {
  OpportunitiesQuery,
  OpportunitySummaryView,
  OpportunityDetailView,
  OpportunityRequirementView,
  OpportunityComparisonView,
  OpportunityComparisonAssumptions,
  ComparisonBreakdown,
  CreateOpportunityExplanationRequest,
  OpportunityExplanationView,
} from "@equipo10/contracts";
import { evaluateC01Compatibility, parseScheduleSummaryToWindows } from "./c01-matcher";
import { AgentA03Service, type IAgentA03Service } from "./agent-a03.service";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";

export interface OpportunitiesDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export class OpportunitiesService {
  private readonly a03: IAgentA03Service;

  constructor(
    private readonly db: OpportunitiesDatabase,
    a03Service?: IAgentA03Service
  ) {
    this.a03 = a03Service ?? new AgentA03Service(db);
  }

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  async listOpportunities(
    identity: VerifiedIdentity,
    params: OpportunitiesQuery
  ): Promise<{ items: OpportunitySummaryView[]; pagination: { total: number; limit: number; offset: number } }> {
    const actorUserId = await this.resolveActor(identity);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const offset = Math.max(params.offset ?? 0, 0);

    return this.db.withActor(actorUserId, async (tx) => {
      const where: any = {
        active: true,
      };

      if (params.occupation_id) {
        where.occupationId = params.occupation_id;
      }

      if (params.workplace_type) {
        where.workplaceType = params.workplace_type;
      }

      if (params.q && params.q.trim().length > 0) {
        const query = params.q.trim();
        where.OR = [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ];
      }

      const [total, rows] = await Promise.all([
        tx.opportunity.count({ where }),
        tx.opportunity.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { publishedAt: "desc" },
          include: {
            organization: { select: { id: true, name: true } },
            occupation: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);

      const items: OpportunitySummaryView[] = rows.map((r: any) => ({
        id: r.id,
        organization: {
          id: r.organization.id,
          name: r.organization.name,
        },
        title: r.title,
        occupation: {
          id: r.occupation.id,
          code: r.occupation.code,
          name: r.occupation.name,
        },
        workplace_type: r.workplaceType,
        location: r.location,
        salary_amount: r.salaryAmount !== null && r.salaryAmount !== undefined ? Number(r.salaryAmount).toFixed(2) : null,
        salary_currency: r.salaryCurrency,
        salary_period: r.salaryPeriod,
        schedule_summary: r.scheduleSummary,
        available_slots: r.availableSlots,
        is_demo: r.isDemo,
        version: r.version,
        published_at: r.publishedAt.toISOString(),
      }));

      return {
        items,
        pagination: {
          total,
          limit,
          offset,
        },
      };
    });
  }

  async getOpportunityById(identity: VerifiedIdentity, id: string): Promise<OpportunityDetailView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const row = await tx.opportunity.findUnique({
        where: { id },
        include: {
          organization: { select: { id: true, name: true } },
          occupation: { select: { id: true, code: true, name: true, description: true } },
          requirements: {
            include: {
              competency: { select: { id: true, code: true, name: true, kind: true } },
            },
            orderBy: [{ requirementType: "asc" }, { stage: "asc" }],
          },
        },
      });

      if (!row || !row.active) {
        throw new AppError(404, "OPPORTUNITY_NOT_FOUND", "Oportunidad no encontrada o inactiva");
      }

      const requirements: OpportunityRequirementView[] = row.requirements.map((req: any) => ({
        id: req.id,
        competency_id: req.competencyId,
        competency_name: req.competency.name,
        competency_kind: req.competency.kind,
        requirement_type: req.requirementType,
        stage: req.stage,
        description: req.description,
      }));

      return {
        id: row.id,
        organization: {
          id: row.organization.id,
          name: row.organization.name,
        },
        title: row.title,
        description: row.description,
        occupation: {
          id: row.occupation.id,
          code: row.occupation.code,
          name: row.occupation.name,
          description: row.occupation.description,
        },
        workplace_type: row.workplaceType,
        location: row.location,
        salary_amount: row.salaryAmount !== null && row.salaryAmount !== undefined ? Number(row.salaryAmount).toFixed(2) : null,
        salary_currency: row.salaryCurrency,
        salary_period: row.salaryPeriod,
        schedule_summary: row.scheduleSummary,
        available_slots: row.availableSlots,
        is_demo: row.isDemo,
        version: row.version,
        published_at: row.publishedAt.toISOString(),
        requirements,
      };
    });
  }

  async createComparison(
    identity: VerifiedIdentity,
    opportunityId: string,
    assumptions?: OpportunityComparisonAssumptions | null,
    idempotencyKey?: string
  ): Promise<{ comparison: OpportunityComparisonView; created: boolean }> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({ opportunityId, assumptions: assumptions || {} }))
        .digest("hex");

      if (idempotencyKey) {
        const existingReceipt = await tx.operationReceipt.findUnique({
          where: {
            actorUserId_operation_idempotencyKey: {
              actorUserId,
              operation: "CREATE_OPPORTUNITY_COMPARISON",
              idempotencyKey,
            },
          },
        });

        if (existingReceipt) {
          if (existingReceipt.payloadHash !== payloadHash) {
            throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Clave de idempotencia reutilizada con solicitud diferente");
          }
          return {
            comparison: existingReceipt.receiptPayload as unknown as OpportunityComparisonView,
            created: false,
          };
        }
      }

      // 1. Obtener perfil de candidato
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
        select: { id: true, currentVersionId: true },
      });

      if (!profile || !profile.currentVersionId) {
        throw new AppError(400, "CONFIRMED_PROFILE_REQUIRED", "Se requiere un perfil confirmado para comparar oportunidades");
      }

      // 2. Cargar versión confirmada con todos los claims y enlaces de evidencia
      const confirmedRevision = await tx.profileRevision.findUnique({
        where: { profileId_id: { profileId: profile.id, id: profile.currentVersionId } },
        include: {
          claims: {
            include: { competency: true, evidenceLinks: true },
          },
          constraints: true,
          windows: true,
        },
      });

      if (!confirmedRevision) {
        throw new AppError(400, "CONFIRMED_PROFILE_REQUIRED", "La versión confirmada del perfil no fue encontrada");
      }

      // 3. Cargar Oportunidad
      const opportunity = await tx.opportunity.findUnique({
        where: { id: opportunityId },
        include: {
          requirements: {
            include: { competency: true },
            orderBy: [{ requirementType: "asc" }, { stage: "asc" }],
          },
        },
      });

      if (!opportunity || !opportunity.active) {
        throw new AppError(404, "OPPORTUNITY_NOT_FOUND", "Oportunidad no encontrada o inactiva");
      }

      // 4. Preparar entradas para el motor C01
      const candidateInput = {
        id: profile.id,
        revisionId: confirmedRevision.id,
        displayName: confirmedRevision.displayName,
        claims: confirmedRevision.claims.map((c: any) => ({
          competencyId: c.competencyId,
          competencyCode: c.competency.code,
          catalogVersionId: c.catalogVersionId,
          decision: c.decision,
          hasEvidence: c.evidenceLinks.length > 0,
        })),
        constraints: confirmedRevision.constraints
          ? {
              salaryState: confirmedRevision.constraints.salaryState,
              minimumSalary: confirmedRevision.constraints.minimumSalary ? confirmedRevision.constraints.minimumSalary.toString() : null,
              salaryCurrency: confirmedRevision.constraints.salaryCurrency,
              salaryPeriod: confirmedRevision.constraints.salaryPeriod,
              travelLimitState: confirmedRevision.constraints.travelLimitState,
              maxOneWayMinutes: confirmedRevision.constraints.maxOneWayMinutes,
              availabilityState: confirmedRevision.constraints.availabilityState,
            }
          : null,
        windows: confirmedRevision.windows.map((w: any) => ({
          weekday: w.weekday,
          startMinute: w.startMinute,
          endMinute: w.endMinute,
        })),
      };

      const vacancyInput = {
        id: opportunity.id,
        version: opportunity.version,
        title: opportunity.title,
        salaryAmount: opportunity.salaryAmount ? opportunity.salaryAmount.toString() : null,
        salaryCurrency: opportunity.salaryCurrency,
        salaryPeriod: opportunity.salaryPeriod,
        scheduleSummary: opportunity.scheduleSummary,
        scheduleWindows: parseScheduleSummaryToWindows(opportunity.scheduleSummary) ?? undefined,
        requirements: opportunity.requirements.map((r: any) => ({
          id: r.id,
          competencyId: r.competencyId,
          competencyCode: r.competency.code,
          catalogVersionId: r.catalogVersionId,
          competencyName: r.competency.name,
          requirementType: r.requirementType,
          stage: r.stage,
          description: r.description,
        })),
      };

      // 5. Ejecutar matching determinístico C01
      const matchResult = evaluateC01Compatibility(candidateInput, vacancyInput, assumptions);

      // 6. Persistir resultado de la comparación
      const comparisonId = randomUUID();
      const row = await tx.opportunityComparison.create({
        data: {
          id: comparisonId,
          profileId: profile.id,
          revisionId: confirmedRevision.id,
          opportunityId: opportunity.id,
          opportunityVersion: opportunity.version,
          status: matchResult.status,
          coverageNumerator: matchResult.coverageNumerator,
          coverageDenominator: matchResult.coverageDenominator,
          coveragePercent: matchResult.coveragePercent !== null ? matchResult.coveragePercent : null,
          assumptionsJson: (assumptions as any) || {},
          breakdownJson: matchResult.breakdown as any,
          reasons: matchResult.reasons,
          outdated: false,
        },
      });

      const comparisonView: OpportunityComparisonView = {
        id: row.id,
        profile_id: row.profileId,
        revision_id: row.revisionId,
        opportunity_id: row.opportunityId,
        opportunity_version: row.opportunityVersion,
        status: row.status,
        coverage_numerator: row.coverageNumerator,
        coverage_denominator: row.coverageDenominator,
        coverage_percent: row.coveragePercent !== null && row.coveragePercent !== undefined ? Number(row.coveragePercent) : null,
        assumptions: (row.assumptionsJson as any) || null,
        breakdown: row.breakdownJson as unknown as ComparisonBreakdown,
        reasons: row.reasons,
        outdated: false,
        created_at: row.createdAt.toISOString(),
      };

      // 7. Registrar OperationReceipt si se incluyó Idempotency-Key
      if (idempotencyKey) {
        await tx.operationReceipt.create({
          data: {
            id: randomUUID(),
            actorUserId,
            profileId: profile.id,
            operation: "CREATE_OPPORTUNITY_COMPARISON",
            idempotencyKey,
            payloadHash,
            receiptPayload: comparisonView as any,
          },
        });
      }

      return { comparison: comparisonView, created: true };
    });
  }

  async getComparisonById(
    identity: VerifiedIdentity,
    comparisonId: string
  ): Promise<OpportunityComparisonView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const row = await tx.opportunityComparison.findUnique({
        where: { id: comparisonId },
        include: {
          profile: { select: { id: true, ownerUserId: true, currentVersionId: true } },
          opportunity: { select: { id: true, version: true, active: true } },
        },
      });

      if (!row || row.profile.ownerUserId !== actorUserId) {
        throw new AppError(404, "COMPARISON_NOT_FOUND", "Comparación no encontrada");
      }

      const outdated =
        row.profile.currentVersionId !== row.revisionId ||
        row.opportunity.version !== row.opportunityVersion;

      return {
        id: row.id,
        profile_id: row.profileId,
        revision_id: row.revisionId,
        opportunity_id: row.opportunityId,
        opportunity_version: row.opportunityVersion,
        status: row.status,
        coverage_numerator: row.coverageNumerator,
        coverage_denominator: row.coverageDenominator,
        coverage_percent: row.coveragePercent !== null && row.coveragePercent !== undefined ? Number(row.coveragePercent) : null,
        assumptions: (row.assumptionsJson as any) || null,
        breakdown: row.breakdownJson as unknown as ComparisonBreakdown,
        reasons: row.reasons,
        outdated,
        created_at: row.createdAt.toISOString(),
      };
    });
  }

  async listComparisons(
    identity: VerifiedIdentity,
    limit: number = 10
  ): Promise<OpportunityComparisonView[]> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const rows = await tx.opportunityComparison.findMany({
        where: {
          profile: {
            ownerUserId: actorUserId,
          },
        },
        include: {
          opportunity: { select: { version: true } },
          profile: { select: { currentVersionId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(limit, 1), 50),
      });

      return rows.map((row: any) => {
        const outdated =
          row.profile.currentVersionId !== row.revisionId ||
          row.opportunity.version !== row.opportunityVersion;

        return {
          id: row.id,
          profile_id: row.profileId,
          revision_id: row.revisionId,
          opportunity_id: row.opportunityId,
          opportunity_version: row.opportunityVersion,
          status: row.status,
          coverage_numerator: row.coverageNumerator,
          coverage_denominator: row.coverageDenominator,
          coverage_percent: row.coveragePercent !== null && row.coveragePercent !== undefined ? Number(row.coveragePercent) : null,
          assumptions: (row.assumptionsJson as any) || null,
          breakdown: row.breakdownJson as unknown as ComparisonBreakdown,
          reasons: row.reasons,
          outdated,
          created_at: row.createdAt.toISOString(),
        };
      });
    });
  }

  async createExplanation(
    identity: VerifiedIdentity,
    comparisonId: string,
    req: CreateOpportunityExplanationRequest,
    idempotencyKey: string
  ): Promise<{ explanation: OpportunityExplanationView; created: boolean }> {
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(
        400,
        "INVALID_REQUEST",
        "Encabezado Idempotency-Key requerido (longitud entre 16 y 128 caracteres)"
      );
    }

    const actorUserId = await this.resolveActor(identity);
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ comparisonId, consent: req.consent, answers: req.answers ?? [] }))
      .digest("hex");

    // 1. Idempotency check
    const existing = await this.db.withActor(actorUserId, async (tx) => {
      return tx.operationReceipt.findFirst({
        where: {
          actorUserId,
          idempotencyKey,
        },
      });
    });

    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "La clave de idempotencia ya fue utilizada con una solicitud diferente"
        );
      }
      return { explanation: existing.receiptPayload as unknown as OpportunityExplanationView, created: false };
    }

    // 2. Invoke A03 agent outside database transaction
    const { explanation } = await this.a03.explainComparison({
      comparisonId,
      actorUserId,
      consent: req.consent,
      answers: req.answers,
    });

    // 3. Persist explanation, audit event, and receipt in ONE SINGLE ATOMIC TRANSACTION
    return this.db.withActor(actorUserId, async (tx) => {
      // Re-check for concurrent race condition inside transaction
      const raceReceipt = await tx.operationReceipt.findFirst({
        where: { actorUserId, idempotencyKey },
      });
      if (raceReceipt) {
        if (raceReceipt.payloadHash !== payloadHash) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "La clave de idempotencia ya fue utilizada con una solicitud diferente");
        }
        return { explanation: raceReceipt.receiptPayload as unknown as OpportunityExplanationView, created: false };
      }

      // Persist explanation
      await tx.opportunityExplanation.create({
        data: {
          id: explanation.id,
          comparisonId: explanation.comparison_id,
          actorUserId,
          agentId: explanation.agent_id,
          contractVersion: explanation.contract_version,
          status: explanation.status,
          summary: explanation.summary,
          decisionJson: explanation.decision as any,
          missingFieldsJson: explanation.missing_fields,
          questionsJson: explanation.questions as any,
          consentGranted: true,
        },
      });

      // Persist audit event
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
        select: { id: true },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile ? profile.id : null,
          caseId: "CU03",
          event: "OPPORTUNITY_EXPLANATION_GENERATED",
          reasonCode: explanation.decision.code || "FEASIBILITY_EXPLAINED",
        },
      });

      // Persist operation receipt
      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile ? profile.id : null,
          operation: "CREATE_OPPORTUNITY_EXPLANATION",
          idempotencyKey,
          payloadHash,
          receiptPayload: explanation as any,
        },
      });

      return { explanation, created: true };
    });
  }

  async getExplanationByComparisonId(
    identity: VerifiedIdentity,
    comparisonId: string
  ): Promise<OpportunityExplanationView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const row = await tx.opportunityExplanation.findFirst({
        where: { comparisonId, actorUserId },
        orderBy: { createdAt: "desc" },
      });

      if (!row) {
        throw new AppError(404, "EXPLANATION_NOT_FOUND", "Explicación no encontrada para la comparación");
      }

      return {
        id: row.id,
        comparison_id: row.comparisonId,
        agent_id: "A03" as const,
        contract_version: "agent-result/1" as const,
        status: row.status as any,
        summary: row.summary,
        decision: row.decisionJson as any,
        missing_fields: (row.missingFieldsJson as string[]) || [],
        questions: (row.questionsJson as any) || [],
        created_at: row.createdAt.toISOString(),
      };
    });
  }
}
