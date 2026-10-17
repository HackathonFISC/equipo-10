import { randomUUID } from "node:crypto";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";
import { AppError } from "../../errors";
import type { VerifiedIdentity } from "../../security/auth";
import type {
  CreateOpportunityDraftRequest,
  UpdateOpportunityDraftRequest,
  PublishOpportunityDraftRequest,
  OpportunityDraftView,
  EmployerApplicationItemView,
  EmployerCandidateSkillView,
  EmployerCandidateGapView,
  OpportunityDetailView,
  OpportunityDraftRequirement,
  DiscriminatoryWarning,
} from "@equipo10/contracts";
import type { IAgentA01Service } from "./agent-a01.service";
import { evaluateC01Compatibility, parseScheduleSummaryToWindows } from "../opportunities/c01-matcher";

export interface RecruitmentDb {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

export class RecruitmentService {
  constructor(
    private readonly db: RecruitmentDb,
    private readonly a01: IAgentA01Service
  ) {}

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  // Verificación estricta de pertenencia a la empresa (ADMIN o RECRUITER)
  async verifyEmployerMembership(tx: Prisma.TransactionClient, actorUserId: string, organizationId: string): Promise<void> {
    const membership = await tx.organizationMembership.findFirst({
      where: {
        userId: actorUserId,
        organizationId,
        status: "ACTIVE",
        role: { in: ["ADMIN", "RECRUITER"] },
        organization:{active:true,type:"COMPANY"},
      },
    });

    if (!membership) {
      throw new AppError(403, "ORGANIZATION_ACCESS_DENIED", "No tienes permisos de reclutador o administrador en esta empresa");
    }
  }

  async createDraft(
    identity: VerifiedIdentity,
    organizationId: string,
    req: CreateOpportunityDraftRequest
  ): Promise<OpportunityDraftView> {
    const actorUserId = await this.resolveActor(identity);

    // 1. Verificar pertenencia y crear borrador inicial
    const draftId = randomUUID();
    const deterministicWarnings = this.a01.detectDiscriminatoryTerms(req.raw_text);

    const catalogVersionId=await this.db.withActor(actorUserId, async (tx) => {
      await this.verifyEmployerMembership(tx, actorUserId, organizationId);
      const catalog=await tx.catalogVersion.findFirst({orderBy:[{createdAt:"desc"},{id:"desc"}]});
      if(!catalog)throw new AppError(409,"CATALOG_NOT_FOUND","No hay catálogo disponible");

      await tx.opportunityDraft.create({
        data: {
          id: draftId,
          organizationId,
          authorUserId: actorUserId,
          rawText: req.raw_text,
          catalogVersionId:catalog.id,
          title: req.title ?? null,
          location: req.location ?? null,
          workplaceType: req.workplace_type ?? "ON_SITE",
          salaryAmount: req.salary_amount !== undefined ? req.salary_amount : null,
          salaryCurrency: req.salary_currency ?? "USD",
          salaryPeriod: req.salary_period ?? null,
          scheduleSummary: req.schedule_summary ?? null,
          availableSlots: req.available_slots ?? 1,
          hasBlockingIssues: deterministicWarnings.length > 0,
          discriminatoryWarnings: deterministicWarnings as any,
          status: "DRAFT",
        },
      });
      return catalog.id;
    });

    // 2. Invocar A01 para normalización de puesto y competencias
    // Si Vertex falla, conservamos el borrador y propagamos el error para que sea recuperable
    let a01Result;
    try {
      a01Result = await this.a01.analyzeVacancy({ rawText: req.raw_text, actorUserId,catalogVersionId });
    } catch (err: any) {
      // El borrador ya existe y está a salvo en la BD.
      throw err;
    }

    // 3. Actualizar borrador con las propuestas de A01
    return this.db.withActor(actorUserId, async (tx) => {
      const updated = await tx.opportunityDraft.update({
        where: { id: draftId },
        data: {
          title: a01Result.title ?? req.title,
          occupationId: a01Result.occupation_id ?? null,
          proposedRequirements: a01Result.proposed_requirements as any,
          clarificationQuestions: a01Result.clarification_questions as any,
          discriminatoryWarnings: a01Result.discriminatory_warnings as any,
          hasBlockingIssues: a01Result.has_blocking_issues,
          status: a01Result.has_blocking_issues ? "DRAFT" : "READY_TO_PUBLISH",
        },
      });

      return this.mapDraftToView(tx, updated);
    });
  }

  async getDraft(identity: VerifiedIdentity, organizationId: string, draftId: string): Promise<OpportunityDraftView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      await this.verifyEmployerMembership(tx, actorUserId, organizationId);

      const draft = await tx.opportunityDraft.findFirst({
        where: { id: draftId, organizationId },
      });

      if (!draft) {
        throw new AppError(404, "DRAFT_NOT_FOUND", "Borrador de vacante no encontrado");
      }

      return this.mapDraftToView(tx, draft);
    });
  }

  async updateDraft(
    identity: VerifiedIdentity,
    organizationId: string,
    draftId: string,
    req: UpdateOpportunityDraftRequest
  ): Promise<OpportunityDraftView> {
    const actorUserId = await this.resolveActor(identity);
    const analysisSnapshot=await this.db.withActor(actorUserId,async tx=>{
      await this.verifyEmployerMembership(tx,actorUserId,organizationId);
      const draft=await tx.opportunityDraft.findFirst({where:{id:draftId,organizationId}});
      if(!draft)throw new AppError(404,"DRAFT_NOT_FOUND","Borrador no encontrado");
      return draft;
    });
    // Human answers can resolve ambiguity, but only a fresh semantic analysis
    // may replace a previous semantic warning. No provider call inside a TX.
    const reanalysis=req.clarification_answers!==undefined
      ? await this.a01.analyzeVacancy({actorUserId,catalogVersionId:analysisSnapshot.catalogVersionId??undefined,
        rawText:`${analysisSnapshot.rawText}\nTítulo revisado: ${req.title??analysisSnapshot.title??""}\nPreguntas y respuestas del reclutador: ${JSON.stringify({questions:analysisSnapshot.clarificationQuestions,answers:req.clarification_answers})}`})
      : null;
    return this.db.withActor(actorUserId, async (tx) => {
      await this.verifyEmployerMembership(tx, actorUserId, organizationId);

      const existing = await tx.opportunityDraft.findFirst({
        where: { id: draftId, organizationId },
      });

      if (!existing) {
        throw new AppError(404, "DRAFT_NOT_FOUND", "Borrador de vacante no encontrado");
      }

      if (existing.status === "PUBLISHED") {
        throw new AppError(400, "DRAFT_ALREADY_PUBLISHED", "No se puede editar un borrador ya publicado");
      }
      if(existing.updatedAt.valueOf()!==analysisSnapshot.updatedAt.valueOf())throw new AppError(409,"DRAFT_OUTDATED","El borrador cambió; vuelve a cargarlo");

      // Re-comprobar términos discriminatorios en título o texto
      const textToInspect = `${req.title || existing.title || ""} ${existing.rawText}`;
      const previousWarnings=(Array.isArray(existing.discriminatoryWarnings)?existing.discriminatoryWarnings:[]) as unknown as DiscriminatoryWarning[];
      const warnings = [...(reanalysis?.discriminatory_warnings??previousWarnings),...this.a01.detectDiscriminatoryTerms(textToInspect)];

      const updated = await tx.opportunityDraft.update({
        where: { id: draftId },
        data: {
          title: req.title !== undefined ? req.title : existing.title,
          occupationId: req.occupation_id !== undefined ? req.occupation_id : reanalysis?.occupation_id??existing.occupationId,
          location: req.location !== undefined ? req.location : existing.location,
          workplaceType: req.workplace_type !== undefined ? req.workplace_type : existing.workplaceType,
          salaryAmount: req.salary_amount !== undefined ? req.salary_amount : existing.salaryAmount,
          salaryCurrency: req.salary_currency !== undefined ? req.salary_currency : existing.salaryCurrency,
          salaryPeriod: req.salary_period !== undefined ? req.salary_period : existing.salaryPeriod,
          scheduleSummary: req.schedule_summary !== undefined ? req.schedule_summary : existing.scheduleSummary,
          availableSlots: req.available_slots !== undefined ? req.available_slots : existing.availableSlots,
          proposedRequirements: req.proposed_requirements !== undefined ? (req.proposed_requirements as any) : reanalysis?.proposed_requirements??existing.proposedRequirements,
          clarificationQuestions:(reanalysis?.clarification_questions??existing.clarificationQuestions) as any,
          clarificationAnswers: req.clarification_answers !== undefined ? (req.clarification_answers as any) : existing.clarificationAnswers,
          discriminatoryWarnings: warnings as any,
          hasBlockingIssues: warnings.length > 0,
          status: warnings.length > 0 ? "DRAFT" : "READY_TO_PUBLISH",
        },
      });

      return this.mapDraftToView(tx, updated);
    });
  }

  async publishDraft(
    identity: VerifiedIdentity,
    organizationId: string,
    draftId: string,
    req: PublishOpportunityDraftRequest
  ): Promise<OpportunityDetailView> {
    const actorUserId = await this.resolveActor(identity);
    const snapshot=await this.db.withActor(actorUserId,async tx=>{
      await this.verifyEmployerMembership(tx,actorUserId,organizationId);
      const d=await tx.opportunityDraft.findFirst({where:{id:draftId,organizationId}});
      if(!d)throw new AppError(404,"DRAFT_NOT_FOUND","Borrador no encontrado");return d;
    });
    const semantic=snapshot.status==="PUBLISHED"?null:await this.a01.analyzeVacancy({actorUserId,catalogVersionId:snapshot.catalogVersionId??undefined,
      rawText:`${snapshot.rawText}\nTítulo final: ${req.title}\nRequisitos revisados: ${req.requirements.map(r=>r.description).join("; ")}\nAclaraciones: ${JSON.stringify(snapshot.clarificationAnswers)}`});

    return this.db.withActor(actorUserId, async (tx) => {
      await this.verifyEmployerMembership(tx, actorUserId, organizationId);
      await tx.$queryRaw`SELECT id FROM app."OpportunityDraft" WHERE id=${draftId}::uuid FOR UPDATE`;

      const draft = await tx.opportunityDraft.findFirst({
        where: { id: draftId, organizationId },
      });

      if (!draft) {
        throw new AppError(404, "DRAFT_NOT_FOUND", "Borrador de vacante no encontrado");
      }

      // Idempotencia: si ya está publicada, devolver la vacante existente
      if (draft.status === "PUBLISHED" && draft.publishedOpportunityId) {
        const existingOpp = await this.getOpportunityDetail(tx, draft.publishedOpportunityId);
        if (existingOpp) return existingOpp;
      }
      if(draft.updatedAt.valueOf()!==snapshot.updatedAt.valueOf())throw new AppError(409,"DRAFT_OUTDATED","El borrador cambió durante la revisión");

      // CONTROL OBLIGATORIO: Comprobar alertas discriminatorias bloqueantes
      const combinedText = `${req.title} ${draft.rawText} ${req.requirements.map((r) => r.description).join(" ")}`;
      const warnings = this.a01.detectDiscriminatoryTerms(combinedText);

      if (draft.hasBlockingIssues || warnings.length > 0 || semantic?.has_blocking_issues || semantic?.discriminatory_warnings.length) {
        throw new AppError(
          422,
          "DISCRIMINATORY_TERMS_BLOCKED",
          "La vacante contiene requisitos o expresiones discriminatorias que impiden su publicación. Deben corregirse antes de publicar."
        );
      }

      // Catálogo activo
      const catalog = draft.catalogVersionId ? await tx.catalogVersion.findUnique({where:{id:draft.catalogVersionId}}) : null;
      if (!catalog) {
        throw new AppError(409, "CATALOG_NOT_FOUND", "El borrador no tiene un catálogo fijado; crea un borrador nuevo");
      }
      const occupation=await tx.occupationEntry.findFirst({where:{id:req.occupation_id,catalogVersionId:catalog.id,active:true}});
      const skillIds=[...new Set(req.requirements.map(r=>r.competency_id))];
      const competencyCount=await tx.competencyEntry.count({where:{id:{in:skillIds},catalogVersionId:catalog.id}});
      if(!occupation || competencyCount!==skillIds.length)throw new AppError(422,"INVALID_CATALOG_MAPPING","Puesto y habilidades deben pertenecer al catálogo fijado del borrador");

      // Crear Opportunity en transacción atómica
      const opportunityId = randomUUID();
      await tx.opportunity.create({
        data: {
          id: opportunityId,
          organizationId,
          title: req.title,
          description: draft.rawText.slice(0, 3000),
          occupationId: req.occupation_id,
          catalogVersionId: catalog.id,
          location: req.location,
          workplaceType: req.workplace_type,
          salaryAmount: req.salary_amount !== undefined ? req.salary_amount : draft.salaryAmount,
          salaryCurrency: req.salary_currency ?? draft.salaryCurrency ?? "USD",
          salaryPeriod: req.salary_period ?? draft.salaryPeriod,
          scheduleSummary: req.schedule_summary ?? draft.scheduleSummary,
          availableSlots: req.available_slots ?? draft.availableSlots ?? 1,
          active: true,
          isDemo: false,
          version: 1,
          publishedAt: new Date(),
        },
      });

      // Crear requisitos
      for (const r of req.requirements) {
        await tx.opportunityRequirement.create({
          data: {
            id: randomUUID(),
            opportunityId,
            competencyId: r.competency_id,
            catalogVersionId: catalog.id,
            requirementType: r.requirement_type,
            stage: r.stage,
            description: r.description.slice(0, 1000),
          },
        });
      }

      // Actualizar borrador
      await tx.opportunityDraft.update({
        where: { id: draftId },
        data: {
          status: "PUBLISHED",
          publishedOpportunityId: opportunityId,
          hasBlockingIssues: false,
        },
      });

      const detail = await this.getOpportunityDetail(tx, opportunityId);
      if (!detail) {
        throw new AppError(500, "PUBLISH_FAILED", "No se pudo recuperar la vacante publicada");
      }
      return detail;
    });
  }

  async listCompanyOpportunities(identity: VerifiedIdentity, organizationId: string): Promise<any[]> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      await this.verifyEmployerMembership(tx, actorUserId, organizationId);

      const items = await tx.opportunity.findMany({
        where: { organizationId, active: true },
        include: {
          occupation: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { publishedAt: "desc" },
      });

      return items.map((opp) => ({
        id: opp.id,
        title: opp.title,
        occupation_name: opp.occupation.name,
        location: opp.location,
        workplace_type: opp.workplaceType,
        available_slots: opp.availableSlots,
        published_at: opp.publishedAt.toISOString(),
        applications_count: opp._count.applications,
      }));
    });
  }

  // Consulta empresarial MINIMIZADA (sin nombre, sin sexo/género, sin foto, sin contacto)
  async listApplicationsForOpportunity(
    identity: VerifiedIdentity,
    organizationId: string,
    opportunityId: string
  ): Promise<EmployerApplicationItemView[]> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      await this.verifyEmployerMembership(tx, actorUserId, organizationId);

      // Verificar que la vacante pertenece a esta empresa
      const opp = await tx.opportunity.findFirst({
        where: { id: opportunityId, organizationId },
        include: {
          requirements: {
            include: { competency: true },
          },
        },
      });

      if (!opp) {
        throw new AppError(404, "OPPORTUNITY_NOT_FOUND", "Vacante no encontrada en la empresa");
      }

      // Buscar candidaturas para esta vacante
      const applications = await tx.candidateApplication.findMany({
        where: { opportunityId },
        include: {
          profileRevision: {
            include: {
              claims: { include: { competency: true } },
              evidenceLinks: { include: { evidence: true } },
              constraints: true,
              windows: true,
            },
          },
        },
        orderBy: { consentGivenAt: "desc" },
      });

      const results: EmployerApplicationItemView[] = [];

      for (const app of applications) {
        const candidateAnonymizedId = `CAND-${app.candidateProfileId.slice(0, 8).toUpperCase()}`;

        // Si la postulación fue retirada, se ocultan habilidades y brechas (acceso cortado)
        if (app.status === "WITHDRAWN") {
          results.push({
            id: app.id,
            candidate_anonymized_id: candidateAnonymizedId,
            opportunity_id: app.opportunityId,
            status: "WITHDRAWN",
            consent_given_at: app.consentGivenAt.toISOString(),
            withdrawn_at: app.withdrawnAt ? app.withdrawnAt.toISOString() : null,
            coverage_percentage: null,
            feasibility: "PENDIENTE",
            skills: [],
            gaps: [],
          });
          continue;
        }

        // Postulación ACTIVA: Calcular evaluación C01 contra el perfil confirmado consentido
        const rev = app.profileRevision;
        const match=evaluateC01Compatibility({id:app.candidateProfileId,revisionId:rev.id,
          claims:rev.claims.map(c=>({competencyId:c.competencyId,catalogVersionId:c.catalogVersionId,decision:c.decision,
            hasEvidence:rev.evidenceLinks.some(l=>l.claimId===c.id && l.evidence.kind==="DOCUMENT")})),
          constraints:rev.constraints?{salaryState:rev.constraints.salaryState,minimumSalary:rev.constraints.minimumSalary?.toString(),salaryCurrency:rev.constraints.salaryCurrency,salaryPeriod:rev.constraints.salaryPeriod,travelLimitState:rev.constraints.travelLimitState,maxOneWayMinutes:rev.constraints.maxOneWayMinutes,availabilityState:rev.constraints.availabilityState}:null,
          windows:rev.windows.map(w=>({weekday:w.weekday,startMinute:w.startMinute,endMinute:w.endMinute}))},
          {id:opp.id,version:opp.version,title:opp.title,salaryAmount:opp.salaryAmount?.toString(),salaryCurrency:opp.salaryCurrency,salaryPeriod:opp.salaryPeriod,scheduleSummary:opp.scheduleSummary,scheduleWindows:parseScheduleSummaryToWindows(opp.scheduleSummary)??undefined,
           requirements:opp.requirements.map(r=>({id:r.id,competencyId:r.competencyId,catalogVersionId:r.catalogVersionId,competencyName:r.competency.name,requirementType:r.requirementType,stage:r.stage,description:r.description}))});

        // Habilidades demostradas / documentadas / declaradas
        const skills: EmployerCandidateSkillView[] = rev.claims.map((c) => {
          const links = rev.evidenceLinks.filter((l) => l.claimId === c.id);
          let evidenceStatus: "DECLARADO" | "DOCUMENTADO" | "DEMOSTRADO" | "DESCONOCIDO" = c.decision==="ACCEPTED"?"DECLARADO":"DESCONOCIDO";

          if (c.decision==="ACCEPTED" && links.some((l) => l.evidence.kind === "DOCUMENT")) {
            evidenceStatus = "DOCUMENTADO";
          }

          return {
            competency_id: c.competencyId,
            competency_name: c.competency.name,
            status: evidenceStatus,
            evidence_summary: evidenceStatus === "DOCUMENTADO" ? "Evidencia documental vinculada" : evidenceStatus === "DECLARADO" ? "Declarado por el candidato" : "Sin evidencia aceptada",
          };
        });

        // Brechas y requisitos cumplidos vs la vacante
        const gaps: EmployerCandidateGapView[] = opp.requirements.map((req) => {
          const evaluation=match.breakdown.requirements.find(r=>r.requirement_id===req.id);
          return {
            competency_id: req.competencyId,
            competency_name: req.competency.name,
            requirement_type: req.requirementType,
            stage: req.stage,
            status: evaluation?.status??"DESCONOCIDO",
          };
        });

        const coveragePct = match.coveragePercent;
        const feasibility = match.status;

        results.push({
          id: app.id,
          candidate_anonymized_id: candidateAnonymizedId,
          opportunity_id: app.opportunityId,
          status: "ACTIVE",
          consent_given_at: app.consentGivenAt.toISOString(),
          withdrawn_at: null,
          coverage_percentage: coveragePct,
          feasibility,
          skills,
          gaps,
        });
      }

      return results;
    });
  }

  private async mapDraftToView(tx: Prisma.TransactionClient, draft: any): Promise<OpportunityDraftView> {
    let occName: string | null = null;
    if (draft.occupationId) {
      const occ = await tx.occupationEntry.findFirst({
        where: { id: draft.occupationId },
        select: { name: true },
      });
      occName = occ?.name ?? null;
    }

    return {
      id: draft.id,
      organization_id: draft.organizationId,
      author_user_id: draft.authorUserId,
      raw_text: draft.rawText,
      title: draft.title,
      occupation_id: draft.occupationId,
      occupation_name: occName,
      location: draft.location,
      workplace_type: draft.workplaceType,
      salary_amount: draft.salaryAmount !== null && draft.salaryAmount !== undefined ? Number(draft.salaryAmount) : null,
      salary_currency: draft.salaryCurrency,
      salary_period: draft.salaryPeriod,
      schedule_summary: draft.scheduleSummary,
      available_slots: draft.availableSlots,
      proposed_requirements: (draft.proposedRequirements as any) || [],
      clarification_questions: (draft.clarificationQuestions as any) || [],
      clarification_answers: (draft.clarificationAnswers as any) || [],
      discriminatory_warnings: (draft.discriminatoryWarnings as any) || [],
      has_blocking_issues: draft.hasBlockingIssues,
      status: draft.status,
      published_opportunity_id: draft.publishedOpportunityId,
      created_at: draft.createdAt.toISOString(),
      updated_at: draft.updatedAt.toISOString(),
    };
  }

  private async getOpportunityDetail(tx: Prisma.TransactionClient, id: string): Promise<OpportunityDetailView | null> {
    const opp = await tx.opportunity.findUnique({
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

    if (!opp) return null;

    return {
      id: opp.id,
      organization: {
        id: opp.organization.id,
        name: opp.organization.name,
      },
      title: opp.title,
      description: opp.description,
      occupation: {
        id: opp.occupation.id,
        code: opp.occupation.code,
        name: opp.occupation.name,
        description: opp.occupation.description,
      },
      location: opp.location,
      workplace_type: opp.workplaceType,
      salary_amount: opp.salaryAmount !== null && opp.salaryAmount !== undefined ? Number(opp.salaryAmount).toFixed(2) : null,
      salary_currency: opp.salaryCurrency,
      salary_period: opp.salaryPeriod,
      schedule_summary: opp.scheduleSummary,
      available_slots: opp.availableSlots,
      is_demo: opp.isDemo,
      version: opp.version,
      published_at: opp.publishedAt.toISOString(),
      requirements: opp.requirements.map((r) => ({
        id: r.id,
        competency_id: r.competencyId,
        competency_name: r.competency.name,
        competency_code: r.competency.code,
        competency_kind: r.competency.kind as "KNOWLEDGE" | "SKILL",
        requirement_type: r.requirementType,
        stage: r.stage,
        description: r.description,
      })),
    };
  }
}
