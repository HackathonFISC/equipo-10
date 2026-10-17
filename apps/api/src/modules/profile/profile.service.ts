import { createHash, randomUUID } from "node:crypto";
import { ExperienceItemSchema, TrainingItemSchema, InterestItemSchema, profileProposalIssueMessage } from "@equipo10/contracts";
import { Prisma } from "../../../../../generated/prisma/client.js";
import { AppError } from "../../errors";
import type { Database, ActorTransactionOptions } from "../../infrastructure/database";
import type { VerifiedIdentity } from "../../security/auth";
import type {
  CandidateProfileView,
  ProfileDraftView,
  ProfileDraftIdentityValues,
  ExperienceItem,
  TrainingItem,
  InterestItem,
  AvailabilityWindowView,
  ProfileConstraintsValues,
  DeclarationStatus,
  ProfileSection,
  ReviewDecision,
  ReviewPreviewResponse,
  MissingFieldItem,
  ProfileSnapshotSummary,
  ProfileConfirmationReceipt,
  ConfirmProfileRequest,
  InterpretationGrantRequest,
  InterpretationGrantView,
  ProfileInterpretationRequest,
  InterpretationRunView,
  SuggestionBatchDecisionRequest,
  SuggestionBatchDecisionResponse,
  ProfileSourceView,
  SourceFragmentView,
} from "@equipo10/contracts";
import { AgentA02Service, type IAgentA02Service } from "./agent-a02.service";
import { MultimodalParserService } from "./multimodal-parser.service";
import { StorageService, LocalFileStorageService } from "../../infrastructure/storage";

export interface ProfileDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

const DRAFT_CHILDREN_INCLUDE = {
  experiences: { orderBy: { id: "asc" as const } },
  trainings: { orderBy: { id: "asc" as const } },
  interests: { orderBy: { id: "asc" as const } },
  windows: { orderBy: { id: "asc" as const } },
  constraints: true,
};

export class ProfileService {
  private readonly a02: IAgentA02Service;
  private readonly parser: MultimodalParserService;
  private readonly storage: StorageService;

  constructor(
    private readonly db: ProfileDatabase,
    a02Service?: IAgentA02Service,
    multimodalParser?: MultimodalParserService,
    storageService?: StorageService
  ) {
    this.a02 = a02Service ?? new AgentA02Service(db);
    this.parser = multimodalParser ?? new MultimodalParserService();
    this.storage = storageService ?? new LocalFileStorageService();
  }

  private mapDraft(row: {
    id: string;
    profileId: string;
    baseVersionId: string | null;
    status: string;
    revision: number;
    versionNumber: number | null;
    displayName: string | null;
    headline: string | null;
    experienceStatus: string;
    trainingStatus: string;
    interestsStatus: string;
    createdAt: Date;
    updatedAt: Date;
    experiences?: {
      id: string;
      kind: string;
      title: string;
      organizationName: string | null;
      description: string;
      startMonth: string | null;
      endMonth: string | null;
      ongoing: boolean;
    }[];
    trainings?: {
      id: string;
      name: string;
      providerName: string | null;
      completedOn: Date | null;
    }[];
    interests?: {
      id: string;
      originalText: string;
      occupationId: string | null;
      catalogVersionId: string | null;
    }[];
    windows?: {
      id: string;
      weekday: number;
      startMinute: number;
      endMinute: number;
      timezone: string;
      validFrom: Date;
      validTo: Date;
    }[];
    constraints?: {
      locationState: string;
      approximateZone: string | null;
      availabilityState: string;
      mobilityState: string;
      mobilityModes: string[];
      travelLimitState: string;
      maxOneWayMinutes: number | null;
      salaryState: string;
      minimumSalary: any;
      salaryCurrency: string | null;
      salaryPeriod: string | null;
      transportState: string;
      transportBudget: any;
      transportCurrency: string | null;
      transportPeriod: string | null;
      trainingState: string;
      trainingBudget: any;
      trainingCurrency: string | null;
      trainingPeriod: string | null;
    } | null;
  }): ProfileDraftView {
    return {
      id: row.id,
      profile_id: row.profileId,
      base_version_id: row.baseVersionId,
      status: row.status as "DRAFT" | "CONFIRMED" | "DISCARDED",
      revision: row.revision,
      version_number: row.versionNumber,
      display_name: row.displayName,
      headline: row.headline,
      experience_status: row.experienceStatus as "UNKNOWN" | "NONE" | "PROVIDED",
      training_status: row.trainingStatus as "UNKNOWN" | "NONE" | "PROVIDED",
      interests_status: row.interestsStatus as "UNKNOWN" | "NONE" | "PROVIDED",
      experiences: (row.experiences || []).map((e) => ({
        id: e.id,
        kind: e.kind as any,
        title: e.title,
        organization_name: e.organizationName,
        description: e.description,
        start_month: e.startMonth,
        end_month: e.endMonth,
        ongoing: e.ongoing,
      })),
      trainings: (row.trainings || []).map((t) => ({
        id: t.id,
        name: t.name,
        provider_name: t.providerName,
        completed_on: t.completedOn ? t.completedOn.toISOString().slice(0, 10) : null,
      })),
      interests: (row.interests || []).map((i) => ({
        id: i.id,
        original_text: i.originalText,
        occupation_id: i.occupationId,
        catalog_version_id: i.catalogVersionId,
      })),
      windows: (row.windows || []).map((w) => ({
        id: w.id,
        weekday: w.weekday,
        start_minute: w.startMinute,
        end_minute: w.endMinute,
        timezone: w.timezone,
        valid_from: w.validFrom.toISOString().slice(0, 10),
        valid_to: w.validTo.toISOString().slice(0, 10),
      })),
      constraints: row.constraints
        ? {
            location_state: row.constraints.locationState as any,
            approximate_zone: row.constraints.approximateZone,
            availability_state: row.constraints.availabilityState as any,
            mobility_state: row.constraints.mobilityState as any,
            mobility_modes: row.constraints.mobilityModes as any,
            travel_limit_state: row.constraints.travelLimitState as any,
            max_one_way_minutes: row.constraints.maxOneWayMinutes,
            salary_state: row.constraints.salaryState as any,
            minimum_salary: row.constraints.minimumSalary ? Number(row.constraints.minimumSalary).toFixed(2) : null,
            salary_currency: row.constraints.salaryCurrency,
            salary_period: row.constraints.salaryPeriod as any,
            transport_state: row.constraints.transportState as any,
            transport_budget: row.constraints.transportBudget ? Number(row.constraints.transportBudget).toFixed(2) : null,
            transport_currency: row.constraints.transportCurrency,
            transport_period: row.constraints.transportPeriod as any,
            training_state: row.constraints.trainingState as any,
            training_budget: row.constraints.trainingBudget ? Number(row.constraints.trainingBudget).toFixed(2) : null,
            training_currency: row.constraints.trainingCurrency,
            training_period: row.constraints.trainingPeriod as any,
          }
        : null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async getProfile(identity: VerifiedIdentity): Promise<CandidateProfileView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          currentVersion: { include: DRAFT_CHILDREN_INCLUDE },
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil de candidato no encontrado");
      }

      const activeDraft = profile.revisions[0] ? this.mapDraft(profile.revisions[0]) : null;

      return {
        id: profile.id,
        owner_user_id: profile.ownerUserId,
        current_version_id: profile.currentVersionId,
        active_draft: activeDraft,
        current_version: profile.currentVersion ? this.mapDraft(profile.currentVersion) : null,
      };
    });
  }

  async createDraft(
    identity: VerifiedIdentity,
    baseVersionId: string | null | undefined,
    idempotencyKey: string
  ): Promise<{ draft: ProfileDraftView; created: boolean }> {
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado Idempotency-Key debe tener entre 16 y 128 caracteres");
    }

    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        select: { id: true, currentVersionId: true },
      });

      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil de candidato no encontrado");
      }

      // Serializar la creación concurrente de borradores para el mismo candidato
      await tx.$executeRaw(
        Prisma.sql`SELECT 1 FROM app."CandidateProfile" WHERE id = ${profile.id}::uuid FOR UPDATE;`
      );

      const requestedBaseVersionId = baseVersionId ?? null;
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({ base_version_id: requestedBaseVersionId }))
        .digest("hex");

      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "CREATE_DRAFT",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "La clave de idempotencia ya fue utilizada con un cuerpo diferente");
        }
        return {
          draft: existingReceipt.receiptPayload as unknown as ProfileDraftView,
          created: false,
        };
      }

      const effectiveBaseVersionId = requestedBaseVersionId ?? profile.currentVersionId ?? null;
      if (requestedBaseVersionId && profile.currentVersionId && requestedBaseVersionId !== profile.currentVersionId) {
        throw new AppError(400, "BASE_VERSION_CONFLICT", "La versión base debe coincidir con la versión confirmada actual");
      }
      if (!profile.currentVersionId && requestedBaseVersionId) {
        throw new AppError(400, "BASE_VERSION_CONFLICT", "El perfil aún no tiene una versión confirmada");
      }

      const activeDraft = await tx.profileRevision.findFirst({
        where: { profileId: profile.id, status: "DRAFT" },
        include: DRAFT_CHILDREN_INCLUDE,
        orderBy: { createdAt: "desc" },
      });

      if (activeDraft) {
        if (activeDraft.baseVersionId !== effectiveBaseVersionId) {
          throw new AppError(409, "BASE_VERSION_CONFLICT", "Ya existe un borrador activo basado en otra versión");
        }

        const mapped = this.mapDraft(activeDraft);
        await tx.operationReceipt.create({
          data: {
            id: randomUUID(),
            actorUserId: appUserId,
            profileId: profile.id,
            operation: "CREATE_DRAFT",
            idempotencyKey,
            payloadHash,
            receiptPayload: mapped as unknown as Prisma.InputJsonValue,
          },
        });

        return { draft: mapped, created: false };
      }

      const baseRev = effectiveBaseVersionId
        ? await tx.profileRevision.findFirst({
            where: {
              id: effectiveBaseVersionId,
              profileId: profile.id,
              status: "CONFIRMED",
            },
            include: {
              ...DRAFT_CHILDREN_INCLUDE,
              evidenceLinks: true,
            },
          })
        : null;

      if (effectiveBaseVersionId && !baseRev) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "La versión base especificada no existe o no está confirmada");
      }

      const draftId = randomUUID();
      await tx.profileRevision.create({
        data: {
          id: draftId,
          profileId: profile.id,
          baseVersionId: effectiveBaseVersionId,
          status: "DRAFT",
          revision: 1,
          displayName: baseRev?.displayName ?? null,
          headline: baseRev?.headline ?? null,
          experienceStatus: (baseRev?.experienceStatus ?? "UNKNOWN") as any,
          trainingStatus: (baseRev?.trainingStatus ?? "UNKNOWN") as any,
          interestsStatus: (baseRev?.interestsStatus ?? "UNKNOWN") as any,
        },
      });

      if (baseRev) {
        const experienceIdMap = new Map<string, string>();
        const expData = baseRev.experiences.map((exp) => {
          const newExpId = randomUUID();
          experienceIdMap.set(exp.id, newExpId);
          return {
            id: newExpId,
            profileId: profile.id,
            revisionId: draftId,
            kind: exp.kind,
            title: exp.title,
            organizationName: exp.organizationName,
            description: exp.description,
            startMonth: exp.startMonth,
            endMonth: exp.endMonth,
            ongoing: exp.ongoing,
          };
        });
        if (expData.length > 0) {
          await tx.profileExperience.createMany({ data: expData });
        }

        const trainingIdMap = new Map<string, string>();
        const trnData = baseRev.trainings.map((trn) => {
          const newTrnId = randomUUID();
          trainingIdMap.set(trn.id, newTrnId);
          return {
            id: newTrnId,
            profileId: profile.id,
            revisionId: draftId,
            name: trn.name,
            providerName: trn.providerName,
            completedOn: trn.completedOn,
          };
        });
        if (trnData.length > 0) {
          await tx.trainingDeclaration.createMany({ data: trnData });
        }

        const intData = baseRev.interests.map((interest) => ({
          id: randomUUID(),
          profileId: profile.id,
          revisionId: draftId,
          originalText: interest.originalText,
          occupationId: interest.occupationId,
          catalogVersionId: interest.catalogVersionId,
        }));
        if (intData.length > 0) {
          await tx.jobInterest.createMany({ data: intData });
        }

        const winData = baseRev.windows.map((win) => ({
          id: randomUUID(),
          profileId: profile.id,
          revisionId: draftId,
          weekday: win.weekday,
          startMinute: win.startMinute,
          endMinute: win.endMinute,
          timezone: win.timezone,
          validFrom: win.validFrom,
          validTo: win.validTo,
        }));
        if (winData.length > 0) {
          await tx.availabilityWindow.createMany({ data: winData });
        }

        if (baseRev.constraints) {
          await tx.profileConstraints.create({
            data: {
              id: randomUUID(),
              profileId: profile.id,
              revisionId: draftId,
              locationState: baseRev.constraints.locationState,
              approximateZone: baseRev.constraints.approximateZone,
              availabilityState: baseRev.constraints.availabilityState,
              mobilityState: baseRev.constraints.mobilityState,
              mobilityModes: baseRev.constraints.mobilityModes,
              travelLimitState: baseRev.constraints.travelLimitState,
              maxOneWayMinutes: baseRev.constraints.maxOneWayMinutes,
              salaryState: baseRev.constraints.salaryState,
              minimumSalary: baseRev.constraints.minimumSalary,
              salaryCurrency: baseRev.constraints.salaryCurrency,
              salaryPeriod: baseRev.constraints.salaryPeriod,
              transportState: baseRev.constraints.transportState,
              transportBudget: baseRev.constraints.transportBudget,
              transportCurrency: baseRev.constraints.transportCurrency,
              transportPeriod: baseRev.constraints.transportPeriod,
              trainingState: baseRev.constraints.trainingState,
              trainingBudget: baseRev.constraints.trainingBudget,
              trainingCurrency: baseRev.constraints.trainingCurrency,
              trainingPeriod: baseRev.constraints.trainingPeriod,
            },
          });
        }

        const linkData = baseRev.evidenceLinks
          .map((link) => {
            const newExpId = link.experienceId ? experienceIdMap.get(link.experienceId) : null;
            const newTrnId = link.trainingId ? trainingIdMap.get(link.trainingId) : null;
            if (!newExpId && !newTrnId) return null;
            return {
              id: randomUUID(),
              profileId: profile.id,
              revisionId: draftId,
              evidenceId: link.evidenceId,
              experienceId: newExpId,
              trainingId: newTrnId,
            };
          })
          .filter(Boolean) as any[];
        if (linkData.length > 0) {
          await tx.profileEvidenceLink.createMany({ data: linkData });
        }
      }

      const draftRecord = await tx.profileRevision.findUniqueOrThrow({
        where: { id: draftId },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      const mapped = this.mapDraft(draftRecord);

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "CREATE_DRAFT",
          idempotencyKey,
          payloadHash,
          receiptPayload: mapped as unknown as Prisma.InputJsonValue,
        },
      });

      return { draft: mapped, created: true };
    }, { timeout: 30000, maxWait: 8000 });
  }

  async getActiveDraft(identity: VerifiedIdentity): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        select: { id: true },
      });

      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil de candidato no encontrado");
      }

      const draft = await tx.profileRevision.findFirst({
        where: { profileId: profile.id, status: "DRAFT" },
        include: DRAFT_CHILDREN_INCLUDE,
        orderBy: { createdAt: "desc" },
      });

      if (!draft) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      return {
        draft: this.mapDraft(draft),
        etag: draft.revision.toString(),
      };
    });
  }

  async patchIdentity(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    values: ProfileDraftIdentityValues
  ): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const nextRevision = draft.revision + 1;
      const updatedDisplayName =
        values.display_name !== undefined ? values.display_name : draft.displayName;
      const updatedHeadline =
        values.headline !== undefined ? values.headline : draft.headline;

      const updated = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          displayName: updatedDisplayName,
          headline: updatedHeadline,
          revision: nextRevision,
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      await tx.sectionReview.deleteMany({
        where: {
          revisionId: draft.id,
          section: "ACCOUNT",
        },
      });

      return {
        draft: this.mapDraft(updated),
        etag: nextRevision.toString(),
      };
    });
  }

  async patchExperience(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    values: { status?: DeclarationStatus; items: ExperienceItem[] }
  ): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const newStatus =
        values.status ?? (values.items.length > 0 ? "PROVIDED" : draft.experienceStatus);
      if (newStatus === "NONE" && values.items.length > 0) {
        throw new AppError(400, "INVALID_REQUEST", "El estado NONE exige que la lista de experiencias esté vacía");
      }

      const ownIds = new Set(draft.experiences.map((row) => row.id));
      const requestedIds = values.items.flatMap((item) => item.id ? [item.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !ownIds.has(id))) {
        throw new AppError(400, "INVALID_REQUEST", "Uno de los registros no pertenece a tu borrador o está repetido.");
      }
      const retained = new Set(requestedIds);
      const removedIds = draft.experiences.filter((row) => !retained.has(row.id)).map((row) => row.id);
      // Keep evidence links and stable IDs for retained declarations; remove links only for explicitly removed rows.
      if (removedIds.length) {
        await tx.profileEvidenceLink.deleteMany({ where: { profileId: profile.id, revisionId: draft.id, experienceId: { in: removedIds } } });
        await tx.profileExperience.deleteMany({ where: { profileId: profile.id, revisionId: draft.id, id: { in: removedIds } } });
      }
      for (const item of values.items) {
        const data = { kind: item.kind, title: item.title, organizationName: item.organization_name ?? null,
            description: item.description, startMonth: item.start_month ?? null,
            endMonth: item.end_month ?? null, ongoing: item.ongoing ?? false };
        if (item.id) {
          await tx.profileExperience.updateMany({ where: { id: item.id, profileId: profile.id, revisionId: draft.id }, data });
        } else {
          await tx.profileExperience.create({ data: { id: randomUUID(), profileId: profile.id, revisionId: draft.id, ...data } });
        }
      }

      const nextRevision = draft.revision + 1;
      const updated = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          experienceStatus: newStatus as any,
          revision: nextRevision,
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      await tx.sectionReview.deleteMany({
        where: { revisionId: draft.id, section: "EXPERIENCE" },
      });

      return {
        draft: this.mapDraft(updated),
        etag: nextRevision.toString(),
      };
    });
  }

  async patchTraining(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    values: { status?: DeclarationStatus; items: TrainingItem[] }
  ): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const newStatus =
        values.status ?? (values.items.length > 0 ? "PROVIDED" : draft.trainingStatus);
      if (newStatus === "NONE" && values.items.length > 0) {
        throw new AppError(400, "INVALID_REQUEST", "El estado NONE exige que la lista de formación esté vacía");
      }

      const ownIds = new Set(draft.trainings.map((row) => row.id));
      const requestedIds = values.items.flatMap((item) => item.id ? [item.id] : []);
      if (new Set(requestedIds).size !== requestedIds.length || requestedIds.some((id) => !ownIds.has(id))) {
        throw new AppError(400, "INVALID_REQUEST", "Uno de los registros no pertenece a tu borrador o está repetido.");
      }
      const retained = new Set(requestedIds);
      const removedIds = draft.trainings.filter((row) => !retained.has(row.id)).map((row) => row.id);
      // Keep evidence links and stable IDs for retained declarations; remove links only for explicitly removed rows.
      if (removedIds.length) {
        await tx.profileEvidenceLink.deleteMany({ where: { profileId: profile.id, revisionId: draft.id, trainingId: { in: removedIds } } });
        await tx.trainingDeclaration.deleteMany({ where: { profileId: profile.id, revisionId: draft.id, id: { in: removedIds } } });
      }
      for (const item of values.items) {
        const data = { name: item.name, providerName: item.provider_name ?? null,
            completedOn: item.completed_on ? new Date(item.completed_on) : null };
        if (item.id) {
          await tx.trainingDeclaration.updateMany({ where: { id: item.id, profileId: profile.id, revisionId: draft.id }, data });
        } else {
          await tx.trainingDeclaration.create({ data: { id: randomUUID(), profileId: profile.id, revisionId: draft.id, ...data } });
        }
      }

      const nextRevision = draft.revision + 1;
      const updated = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          trainingStatus: newStatus as any,
          revision: nextRevision,
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      await tx.sectionReview.deleteMany({
        where: { revisionId: draft.id, section: "TRAINING" },
      });

      return {
        draft: this.mapDraft(updated),
        etag: nextRevision.toString(),
      };
    });
  }

  async patchInterests(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    values: { status?: DeclarationStatus; items: InterestItem[] }
  ): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const newStatus =
        values.status ?? (values.items.length > 0 ? "PROVIDED" : draft.interestsStatus);
      if (newStatus === "NONE" && values.items.length > 0) {
        throw new AppError(400, "INVALID_REQUEST", "El estado NONE exige que la lista de intereses esté vacía");
      }

      await tx.jobInterest.deleteMany({
        where: { profileId: profile.id, revisionId: draft.id },
      });

      if (values.items.length > 0) {
        await tx.jobInterest.createMany({
          data: values.items.map((item, idx) => ({
            id: item.id || `00000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
            profileId: profile.id,
            revisionId: draft.id,
            originalText: item.original_text,
            occupationId: item.occupation_id ?? null,
            catalogVersionId: item.catalog_version_id ?? null,
          })),
        });
      }

      const nextRevision = draft.revision + 1;
      const updated = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          interestsStatus: newStatus as any,
          revision: nextRevision,
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      await tx.sectionReview.deleteMany({
        where: { revisionId: draft.id, section: "INTERESTS" },
      });

      return {
        draft: this.mapDraft(updated),
        etag: nextRevision.toString(),
      };
    });
  }

  async patchAvailability(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    values: { windows: AvailabilityWindowView[] }
  ): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      // Check overlap in memory
      for (let i = 0; i < values.windows.length; i++) {
        const a = values.windows[i];
        for (let j = i + 1; j < values.windows.length; j++) {
          const b = values.windows[j];
          if (a.weekday === b.weekday) {
            const datesOverlap = a.valid_from <= b.valid_to && b.valid_from <= a.valid_to;
            const minutesOverlap = a.start_minute < b.end_minute && b.start_minute < a.end_minute;
            if (datesOverlap && minutesOverlap) {
              throw new AppError(
                400,
                "INVALID_REQUEST",
                `Ventanas de disponibilidad solapadas para el día ${a.weekday}`
              );
            }
          }
        }
      }

      await tx.availabilityWindow.deleteMany({
        where: { profileId: profile.id, revisionId: draft.id },
      });

      if (values.windows.length > 0) {
        await tx.availabilityWindow.createMany({
          data: values.windows.map((w, idx) => ({
            id: w.id || `00000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
            profileId: profile.id,
            revisionId: draft.id,
            weekday: w.weekday,
            startMinute: w.start_minute,
            endMinute: w.end_minute,
            timezone: w.timezone || "America/Panama",
            validFrom: new Date(w.valid_from),
            validTo: new Date(w.valid_to),
          })),
        });
      }

      const nextRevision = draft.revision + 1;
      const updated = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          revision: nextRevision,
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      await tx.sectionReview.deleteMany({
        where: { revisionId: draft.id, section: "AVAILABILITY" },
      });

      return {
        draft: this.mapDraft(updated),
        etag: nextRevision.toString(),
      };
    });
  }

  async patchConstraints(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    values: ProfileConstraintsValues
  ): Promise<{ draft: ProfileDraftView; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            include: DRAFT_CHILDREN_INCLUDE,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const locationState = values.location_state || "UNKNOWN";
      const approximateZone = locationState === "KNOWN" ? values.approximate_zone?.trim() || null : null;

      const mobilityState = values.mobility_state || "UNKNOWN";
      const mobilityModes = mobilityState === "KNOWN" ? values.mobility_modes : [];

      const travelLimitState = values.travel_limit_state || "UNKNOWN";
      const maxOneWayMinutes =
        travelLimitState === "KNOWN" && values.max_one_way_minutes !== undefined && values.max_one_way_minutes !== null
          ? values.max_one_way_minutes
          : null;

      const salaryState = values.salary_state || "UNKNOWN";
      const minimumSalary =
        salaryState === "KNOWN" && values.minimum_salary ? new Prisma.Decimal(values.minimum_salary) : null;
      const salaryCurrency = salaryState === "KNOWN" ? values.salary_currency || "USD" : null;
      const salaryPeriod = salaryState === "KNOWN" ? values.salary_period || "MONTH" : null;

      const transportState = values.transport_state || "UNKNOWN";
      const transportBudget =
        transportState === "KNOWN" && values.transport_budget ? new Prisma.Decimal(values.transport_budget) : null;
      const transportCurrency = transportState === "KNOWN" ? values.transport_currency || "USD" : null;
      const transportPeriod = transportState === "KNOWN" ? values.transport_period || "MONTH" : null;

      const trainingState = values.training_state || "UNKNOWN";
      const trainingBudget =
        trainingState === "KNOWN" && values.training_budget ? new Prisma.Decimal(values.training_budget) : null;
      const trainingCurrency = trainingState === "KNOWN" ? values.training_currency || "USD" : null;
      const trainingPeriod = trainingState === "KNOWN" ? values.training_period || "TOTAL" : null;

      await tx.profileConstraints.upsert({
        where: { revisionId: draft.id },
        create: {
          id: randomUUID(),
          profileId: profile.id,
          revisionId: draft.id,
          locationState: locationState as any,
          approximateZone,
          availabilityState: (values.availability_state || "UNKNOWN") as any,
          mobilityState: mobilityState as any,
          mobilityModes: mobilityModes as any,
          travelLimitState: travelLimitState as any,
          maxOneWayMinutes,
          salaryState: salaryState as any,
          minimumSalary,
          salaryCurrency,
          salaryPeriod: salaryPeriod as any,
          transportState: transportState as any,
          transportBudget,
          transportCurrency,
          transportPeriod: transportPeriod as any,
          trainingState: trainingState as any,
          trainingBudget,
          trainingCurrency,
          trainingPeriod: trainingPeriod as any,
        },
        update: {
          locationState: locationState as any,
          approximateZone,
          availabilityState: (values.availability_state || "UNKNOWN") as any,
          mobilityState: mobilityState as any,
          mobilityModes: mobilityModes as any,
          travelLimitState: travelLimitState as any,
          maxOneWayMinutes,
          salaryState: salaryState as any,
          minimumSalary,
          salaryCurrency,
          salaryPeriod: salaryPeriod as any,
          transportState: transportState as any,
          transportBudget,
          transportCurrency,
          transportPeriod: transportPeriod as any,
          trainingState: trainingState as any,
          trainingBudget,
          trainingCurrency,
          trainingPeriod: trainingPeriod as any,
        },
      });

      const nextRevision = draft.revision + 1;
      const updated = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          revision: nextRevision,
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      await tx.sectionReview.deleteMany({
        where: { revisionId: draft.id, section: "CONSTRAINTS" },
      });

      return {
        draft: this.mapDraft(updated),
        etag: nextRevision.toString(),
      };
    });
  }

  async reviewSection(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    section: ProfileSection,
    decision: ReviewDecision,
    idempotencyKey: string
  ): Promise<{ review: { section: string; decision: string; reviewed_at: string }; etag: string }> {
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      throw new AppError(400, "INVALID_REQUEST", "Encabezado Idempotency-Key debe tener entre 16 y 128 caracteres");
    }

    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const review = await tx.sectionReview.upsert({
        where: {
          revisionId_section: {
            revisionId: draft.id,
            section: section as any,
          },
        },
        create: {
          id: randomUUID(),
          revisionId: draft.id,
          section: section as any,
          decision: decision as any,
          contentRevision: draft.revision,
          actorUserId: appUserId,
        },
        update: {
          decision: decision as any,
          contentRevision: draft.revision,
          reviewedAt: new Date(),
        },
      });

      return {
        review: {
          section: review.section,
          decision: review.decision,
          reviewed_at: review.reviewedAt.toISOString(),
        },
        etag: draft.revision.toString(),
      };
    });
  }

  async generateReviewPreview(
    identity: VerifiedIdentity,
    ifMatchRevision: number,
    idempotencyKey: string
  ): Promise<{ preview: ReviewPreviewResponse; etag: string }> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const reqPayloadHash = createHash("sha256").update(JSON.stringify({ ifMatchRevision })).digest("hex");

      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "GENERATE_REVIEW_PREVIEW",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== reqPayloadHash) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "La clave de idempotencia ya fue utilizada con otro payload"
          );
        }
        return existingReceipt.receiptPayload as { preview: ReviewPreviewResponse; etag: string };
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
        include: {
          revisions: {
            where: { status: "DRAFT" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: DRAFT_CHILDREN_INCLUDE,
          },
        },
      });

      if (!profile || profile.revisions.length === 0) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay ningún borrador activo");
      }

      const draft = profile.revisions[0];
      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      const mapped = this.mapDraft(draft);

      const canonicalData = {
        display_name: mapped.display_name,
        headline: mapped.headline,
        experience_status: mapped.experience_status,
        experiences: mapped.experiences.map((e) => ({
          kind: e.kind,
          title: e.title,
          organization_name: e.organization_name,
          description: e.description,
          start_month: e.start_month,
          end_month: e.end_month,
          ongoing: e.ongoing,
        })),
        training_status: mapped.training_status,
        trainings: mapped.trainings.map((t) => ({
          name: t.name,
          provider_name: t.provider_name,
          completed_on: t.completed_on,
        })),
        interests_status: mapped.interests_status,
        interests: mapped.interests.map((i) => ({
          original_text: i.original_text,
          occupation_id: i.occupation_id,
          catalog_version_id: i.catalog_version_id,
        })),
        windows: (mapped.windows || []).map((w) => ({
          weekday: w.weekday,
          start_minute: w.start_minute,
          end_minute: w.end_minute,
          timezone: w.timezone,
          valid_from: w.valid_from,
          valid_to: w.valid_to,
        })),
        constraints: mapped.constraints
          ? {
              location_state: mapped.constraints.location_state,
              approximate_zone: mapped.constraints.approximate_zone,
              availability_state: mapped.constraints.availability_state,
              mobility_state: mapped.constraints.mobility_state,
              mobility_modes: [...mapped.constraints.mobility_modes].sort(),
              travel_limit_state: mapped.constraints.travel_limit_state,
              max_one_way_minutes: mapped.constraints.max_one_way_minutes,
              salary_state: mapped.constraints.salary_state,
              minimum_salary: mapped.constraints.minimum_salary,
              salary_currency: mapped.constraints.salary_currency,
              salary_period: mapped.constraints.salary_period,
              transport_state: mapped.constraints.transport_state,
              transport_budget: mapped.constraints.transport_budget,
              transport_currency: mapped.constraints.transport_currency,
              transport_period: mapped.constraints.transport_period,
              training_state: mapped.constraints.training_state,
              training_budget: mapped.constraints.training_budget,
              training_currency: mapped.constraints.training_currency,
              training_period: mapped.constraints.training_period,
            }
          : null,
      };

      const canonicalJson = JSON.stringify(canonicalData);
      const snapshotDigest = createHash("sha256").update(canonicalJson).digest("hex");

      const missingFields: MissingFieldItem[] = [];
      if (!mapped.headline || mapped.headline.trim().length === 0) {
        missingFields.push({
          section: "ACCOUNT",
          field: "headline",
          message: "No has añadido un titular profesional breve.",
          severity: "INFO",
        });
      }
      if (mapped.experiences.length === 0 && mapped.experience_status !== "NONE") {
        missingFields.push({
          section: "EXPERIENCE",
          field: "experiences",
          message: "No has registrado experiencias laborales ni confirmado 'Sin experiencia previa'.",
          severity: "WARNING",
        });
      }
      if (mapped.trainings.length === 0 && mapped.training_status !== "NONE") {
        missingFields.push({
          section: "TRAINING",
          field: "trainings",
          message: "No has registrado cursos o títulos formativos ni confirmado 'Sin formación previa'.",
          severity: "INFO",
        });
      }
      if (mapped.interests.length === 0 && mapped.interests_status !== "NONE") {
        missingFields.push({
          section: "INTERESTS",
          field: "interests",
          message: "No has seleccionado intereses ocupacionales.",
          severity: "WARNING",
        });
      }
      if (!mapped.windows || mapped.windows.length === 0) {
        missingFields.push({
          section: "AVAILABILITY",
          field: "windows",
          message: "No has configurado ventanas de disponibilidad horaria semanal.",
          severity: "WARNING",
        });
      }
      if (mapped.constraints?.salary_state !== "KNOWN") {
        missingFields.push({
          section: "CONSTRAINTS",
          field: "minimum_salary",
          message: "No has definido tu expectativa salarial mínima.",
          severity: "INFO",
        });
      }
      if (mapped.constraints?.travel_limit_state !== "KNOWN") {
        missingFields.push({
          section: "CONSTRAINTS",
          field: "max_one_way_minutes",
          message: "No has especificado tu tiempo máximo de traslado.",
          severity: "INFO",
        });
      }

      const acknowledgePartialRequired = missingFields.length > 0;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const preview = await tx.profilePreview.create({
        data: {
          id: randomUUID(),
          revisionId: draft.id,
          draftRevision: draft.revision,
          snapshotDigest,
          acknowledgePartialRequired,
          expiresAt,
        },
      });

      const summary: ProfileSnapshotSummary = {
        display_name: mapped.display_name,
        headline: mapped.headline,
        experience_status: mapped.experience_status,
        experiences_count: mapped.experiences.length,
        training_status: mapped.training_status,
        trainings_count: mapped.trainings.length,
        interests_status: mapped.interests_status,
        interests_count: mapped.interests.length,
        availability_windows_count: mapped.windows?.length || 0,
        location_state: mapped.constraints?.location_state || "UNKNOWN",
        approximate_zone: mapped.constraints?.approximate_zone || null,
        mobility_modes: mapped.constraints?.mobility_modes || [],
        max_one_way_minutes: mapped.constraints?.max_one_way_minutes ?? null,
        salary_state: mapped.constraints?.salary_state || "UNKNOWN",
        minimum_salary: mapped.constraints?.minimum_salary || null,
        transport_budget: mapped.constraints?.transport_budget || null,
        training_budget: mapped.constraints?.training_budget || null,
      };

      const previewResponse: ReviewPreviewResponse = {
        preview_id: preview.id,
        draft_id: draft.id,
        draft_revision: draft.revision,
        snapshot_digest: snapshotDigest,
        acknowledge_partial_required: acknowledgePartialRequired,
        expires_at: preview.expiresAt.toISOString(),
        missing_fields: missingFields,
        summary,
      };

      const result = {
        preview: previewResponse,
        etag: draft.revision.toString(),
      };

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "GENERATE_REVIEW_PREVIEW",
          idempotencyKey,
          payloadHash: reqPayloadHash,
          receiptPayload: result as any,
        },
      });

      return result;
    });
  }

  async confirmProfile(
    identity: VerifiedIdentity,
    params: ConfirmProfileRequest,
    ifMatchRevision: number,
    idempotencyKey: string
  ): Promise<ProfileConfirmationReceipt> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const reqPayloadHash = createHash("sha256").update(JSON.stringify(params)).digest("hex");

      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "CONFIRM_PROFILE",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== reqPayloadHash) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "La clave de idempotencia ya fue utilizada con otro payload"
          );
        }
        return existingReceipt.receiptPayload as ProfileConfirmationReceipt;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });

      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const draft = await tx.profileRevision.findUnique({
        where: { id: params.draft_id },
      });

      if (!draft || draft.profileId !== profile.id || draft.status !== "DRAFT") {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Borrador activo no encontrado o ya confirmado");
      }

      if (draft.revision !== ifMatchRevision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El perfil cambió en otra pestaña. Revisa la versión guardada antes de continuar."
        );
      }

      if (!draft.displayName?.trim()) {
        throw new AppError(400, "PROFILE_NAME_REQUIRED", "Antes de confirmar, vuelve a Cuenta e indica el nombre que quieres usar en tu perfil.");
      }

      const preview = await tx.profilePreview.findUnique({
        where: { id: params.preview_id },
      });

      if (!preview || preview.revisionId !== draft.id) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "El preview indicado no corresponde al borrador");
      }

      if (preview.expiresAt < new Date()) {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "El preview temporal ha expirado (vigencia 15 min). Genera una nueva revisión antes de confirmar."
        );
      }

      if (preview.draftRevision !== draft.revision) {
        throw new AppError(
          412,
          "DRAFT_REVISION_CONFLICT",
          "El borrador cambió tras generar el preview. Genera un nuevo preview para confirmar."
        );
      }

      if (preview.acknowledgePartialRequired && !params.acknowledge_partial) {
        throw new AppError(
          400,
          "INVALID_REQUEST",
          "Se requiere aceptar conscientemente las secciones incompletas para confirmar el perfil."
        );
      }

      // Asegurar que las 8 revisiones de sección existan para cumplir guard_revision
      const ALL_SECTIONS = [
        "ACCOUNT",
        "EXPERIENCE",
        "TRAINING",
        "INTERESTS",
        "COMPETENCIES",
        "AVAILABILITY",
        "CONSTRAINTS",
        "FINAL_REVIEW",
      ];
      for (const sec of ALL_SECTIONS) {
        await tx.sectionReview.upsert({
          where: {
            revisionId_section: {
              revisionId: draft.id,
              section: sec as any,
            },
          },
          create: {
            id: randomUUID(),
            revisionId: draft.id,
            section: sec as any,
            decision: "REVIEWED",
            contentRevision: draft.revision,
            actorUserId: appUserId,
          },
          update: {
            decision: "REVIEWED",
            contentRevision: draft.revision,
            reviewedAt: new Date(),
          },
        });
      }

      const maxVer = await tx.profileRevision.aggregate({
        where: { profileId: profile.id },
        _max: { versionNumber: true },
      });
      const nextVersionNumber = (maxVer._max.versionNumber || 0) + 1;

      const confirmedAt = new Date();
      const operationReceiptId = randomUUID();
      const confirmationId = randomUUID();

      const receiptPayload: ProfileConfirmationReceipt = {
        receipt_id: operationReceiptId,
        confirmation_id: confirmationId,
        profile_id: profile.id,
        version_id: draft.id,
        version_number: nextVersionNumber,
        confirmed_at: confirmedAt.toISOString(),
        snapshot_digest: preview.snapshotDigest,
        acknowledged_partial: Boolean(params.acknowledge_partial),
      };

      // 1. OperationReceipt
      await tx.operationReceipt.create({
        data: {
          id: operationReceiptId,
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "CONFIRM_PROFILE",
          idempotencyKey,
          payloadHash: reqPayloadHash,
          receiptPayload: receiptPayload as any,
        },
      });

      // 2. ProfileConfirmation
      await tx.profileConfirmation.create({
        data: {
          id: confirmationId,
          revisionId: draft.id,
          previewId: preview.id,
          operationId: operationReceiptId,
          actorUserId: appUserId,
          acknowledgedPartial: Boolean(params.acknowledge_partial),
          confirmedAt,
        },
      });

      // 3. AuditEvent
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          revisionId: draft.id,
          operationId: operationReceiptId,
          caseId: "CU01",
          event: "PROFILE_CONFIRMED",
          reasonCode: "CONFIRM_PROFILE_MANUAL",
        },
      });

      // 4. ProfileRevision transition to CONFIRMED (revision increments by 1)
      await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          status: "CONFIRMED",
          revision: draft.revision + 1,
          versionNumber: nextVersionNumber,
          confirmedAt,
          confirmedById: appUserId,
          snapshotDigest: preview.snapshotDigest,
        },
      });

      // 5. CandidateProfile currentVersionId
      await tx.candidateProfile.update({
        where: { id: profile.id },
        data: {
          currentVersionId: draft.id,
        },
      });

      return receiptPayload;
    }, { timeout: 30000, maxWait: 8000 });
  }

  async getVersion(identity: VerifiedIdentity, versionId: string): Promise<any> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }
      const revision = await tx.profileRevision.findUnique({
        where: { id: versionId },
        include: DRAFT_CHILDREN_INCLUDE,
      });
      if (!revision || revision.profileId !== profile.id || revision.status !== "CONFIRMED") {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Versión confirmada no encontrada");
      }
      return this.mapDraft(revision);
    });
  }

  async getOperationReceipt(identity: VerifiedIdentity, receiptId: string): Promise<any> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const receipt = await tx.operationReceipt.findUnique({
        where: { id: receiptId },
      });
      if (!receipt || receipt.actorUserId !== appUserId) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Recibo no encontrado");
      }
      return receipt.receiptPayload;
    });
  }

  async createManualTextSource(
    identity: VerifiedIdentity,
    text: string,
    idempotencyKey: string
  ): Promise<ProfileSourceView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ kind: "manual_text", text }))
      .digest("hex");

    return this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "CREATE_SOURCE",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "La clave de idempotencia ya fue utilizada con un contenido diferente"
          );
        }
        return existingReceipt.receiptPayload as unknown as ProfileSourceView;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const sha256 = createHash("sha256").update(text, "utf-8").digest("hex");
      const sizeBytes = Buffer.byteLength(text, "utf-8");

      const source = await tx.profileSource.create({
        data: {
          id: randomUUID(),
          profileId: profile.id,
          version: 1,
          kind: "MANUAL_TEXT",
          status: "READY",
          sha256,
          mediaType: "text/plain; charset=utf-8",
          sizeBytes,
          manualText: text,
        },
      });

      const fragment = await tx.sourceFragment.create({
        data: {
          id: randomUUID(),
          profileId: profile.id,
          sourceId: source.id,
          text: text.slice(0, 20000),
          page: null,
          startMillis: null,
          endMillis: null,
        },
      });

      const responsePayload: ProfileSourceView = {
        id: source.id,
        profile_id: profile.id,
        kind: "MANUAL_TEXT",
        status: "READY",
        version: 1,
        sha256,
        media_type: "text/plain; charset=utf-8",
        size_bytes: sizeBytes,
        fragments_count: 1,
        fragments: [
          {
            id: fragment.id,
            text: fragment.text,
            page: null,
            start_millis: null,
            end_millis: null,
          },
        ],
        created_at: source.createdAt.toISOString(),
      };

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "CREATE_SOURCE",
          idempotencyKey,
          payloadHash,
          receiptPayload: responsePayload as any,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          caseId: "CU01",
          event: "PROFILE_SOURCE_CREATED",
          reasonCode: "MANUAL_TEXT",
        },
      });

      return responsePayload;
    });
  }

  async createMultimodalSource(
    identity: VerifiedIdentity,
    buffer: Buffer,
    declaredKind: string,
    idempotencyKey: string
  ): Promise<ProfileSourceView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const parsed = await this.parser.validateAndParse(buffer, declaredKind);
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ kind: declaredKind, sha256: parsed.sha256, sizeBytes: parsed.sizeBytes }))
      .digest("hex");

    return this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "CREATE_SOURCE",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "La clave de idempotencia ya fue utilizada con un contenido diferente"
          );
        }
        return existingReceipt.receiptPayload as unknown as ProfileSourceView;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const sourceId = randomUUID();
      const storageKey = `sources/${profile.id}/${sourceId}/${parsed.sha256}`;
      // Persistir buffer físico original en almacenamiento privado
      await this.storage.save(storageKey, buffer);

      const source = await tx.profileSource.create({
        data: {
          id: sourceId,
          profileId: profile.id,
          version: 1,
          kind: parsed.kind,
          status: parsed.status,
          sha256: parsed.sha256,
          mediaType: parsed.mediaType,
          sizeBytes: parsed.sizeBytes,
          storageKey,
        },
      });

      const fragmentsViews: SourceFragmentView[] = [];
      for (const frag of parsed.fragments) {
        const createdFrag = await tx.sourceFragment.create({
          data: {
            id: randomUUID(),
            profileId: profile.id,
            sourceId: source.id,
            text: frag.text,
            page: frag.page || null,
            startMillis: frag.startMillis ?? null,
            endMillis: frag.endMillis ?? null,
          },
        });
        fragmentsViews.push({
          id: createdFrag.id,
          text: createdFrag.text,
          page: createdFrag.page,
          start_millis: createdFrag.startMillis,
          end_millis: createdFrag.endMillis,
        });
      }

      const responsePayload: ProfileSourceView = {
        id: source.id,
        profile_id: profile.id,
        kind: parsed.kind,
        status: parsed.status,
        version: 1,
        sha256: parsed.sha256,
        media_type: parsed.mediaType,
        size_bytes: parsed.sizeBytes,
        fragments_count: fragmentsViews.length,
        fragments: fragmentsViews,
        created_at: source.createdAt.toISOString(),
      };

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "CREATE_SOURCE",
          idempotencyKey,
          payloadHash,
          receiptPayload: responsePayload as any,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          caseId: "CU01",
          event: "PROFILE_SOURCE_CREATED",
          reasonCode: parsed.kind,
        },
      });

      return responsePayload;
    });
  }

  async getSource(identity: VerifiedIdentity, sourceId: string): Promise<ProfileSourceView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const source = await tx.profileSource.findUnique({
        where: { id: sourceId },
        include: { fragments: { orderBy: { id: "asc" } } },
      });

      if (!source || source.profileId !== profile.id) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Fuente no encontrada");
      }

      return {
        id: source.id,
        profile_id: source.profileId,
        kind: source.kind,
        status: source.status,
        version: source.version,
        sha256: source.sha256,
        media_type: source.mediaType,
        size_bytes: source.sizeBytes,
        fragments_count: source.fragments.length,
        fragments: source.fragments.map((f) => ({
          id: f.id,
          text: f.text,
          page: f.page,
          start_millis: f.startMillis,
          end_millis: f.endMillis,
        })),
        created_at: source.createdAt.toISOString(),
      };
    });
  }

  async withdrawSource(
    identity: VerifiedIdentity,
    sourceId: string,
    reason: string | undefined,
    idempotencyKey: string
  ): Promise<any> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ sourceId, reason }))
      .digest("hex");

    return this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "WITHDRAW_SOURCE",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "La clave de idempotencia ya fue utilizada con un contenido diferente");
        }
        return existingReceipt.receiptPayload;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const source = await tx.profileSource.findUnique({
        where: { id: sourceId },
      });

      if (!source || source.profileId !== profile.id) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Fuente no encontrada");
      }

      await tx.profileSource.update({
        where: { id: sourceId },
        data: { status: "WITHDRAWN" },
      });

      const result = {
        source_id: sourceId,
        status: "WITHDRAWN",
        withdrawn_at: new Date().toISOString(),
        reason: reason || null,
      };

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "WITHDRAW_SOURCE",
          idempotencyKey,
          payloadHash,
          receiptPayload: result,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          caseId: "CU01",
          event: "PROFILE_SOURCE_WITHDRAWN",
          reasonCode: reason || "USER_WITHDRAWAL",
        },
      });

      return result;
    });
  }

  async createInterpretationGrant(
    identity: VerifiedIdentity,
    request: InterpretationGrantRequest,
    idempotencyKey: string
  ): Promise<InterpretationGrantView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(request))
      .digest("hex");

    return this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "INTERPRETATION_GRANT",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "La clave de idempotencia ya fue utilizada con una autorización diferente"
          );
        }
        return existingReceipt.receiptPayload as unknown as InterpretationGrantView;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const draft = await tx.profileRevision.findFirst({
        where: { profileId: profile.id, status: "DRAFT" },
      });
      if (!draft) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay borrador activo para el perfil");
      }

      if (draft.revision !== request.draft_revision) {
        throw new AppError(
          409,
          "BASE_VERSION_CONFLICT",
          "La revisión del borrador no coincide con la versión solicitada para la autorización"
        );
      }

      // Validar que todas las fuentes existen, pertenecen al perfil y están listas
      for (const ref of request.source_refs) {
        const source = await tx.profileSource.findUnique({
          where: { id: ref.id },
        });
        if (!source || source.profileId !== profile.id || source.status === "WITHDRAWN" || source.status === "FAILED") {
          throw new AppError(
            422,
            "PROCESSING_GRANT_REQUIRED",
            `La fuente referenciada ${ref.id} no existe o no se encuentra disponible para procesamiento`
          );
        }
      }

      const grantId = randomUUID();
      const grantPayload: InterpretationGrantView = {
        grant_id: grantId,
        profile_id: profile.id,
        status: "ACTIVE",
        source_refs: request.source_refs,
        draft_revision: request.draft_revision,
        purpose: request.purpose,
        provider: request.provider,
        created_at: new Date().toISOString(),
      };

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "INTERPRETATION_GRANT",
          idempotencyKey,
          payloadHash,
          receiptPayload: grantPayload as any,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          caseId: "CU01",
          event: "INTERPRETATION_GRANT_CREATED",
          reasonCode: "USER_CONSENT",
        },
      });

      return grantPayload;
    });
  }

  async revokeInterpretationGrant(
    identity: VerifiedIdentity,
    grantId: string,
    idempotencyKey: string
  ): Promise<any> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ grantId, action: "revoke" }))
      .digest("hex");

    return this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "REVOKE_GRANT",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "La clave de idempotencia ya fue utilizada con un contenido diferente");
        }
        return existingReceipt.receiptPayload;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      // Buscar el grant en los recibos del actor
      const grantReceipts = await tx.operationReceipt.findMany({
        where: {
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "INTERPRETATION_GRANT",
        },
      });

      const found = grantReceipts.find((r) => {
        const payload = r.receiptPayload as any;
        return payload?.grant_id === grantId;
      });

      if (!found) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Autorización no encontrada");
      }

      const response = {
        grant_id: grantId,
        status: "REVOKED",
        revoked_at: new Date().toISOString(),
      };

      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "REVOKE_GRANT",
          idempotencyKey,
          payloadHash,
          receiptPayload: response,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          caseId: "CU01",
          event: "INTERPRETATION_GRANT_REVOKED",
          reasonCode: "USER_REVOCATION",
        },
      });

      return response;
    });
  }

  async requestInterpretation(
    identity: VerifiedIdentity,
    request: ProfileInterpretationRequest,
    ifMatchRev: number,
    idempotencyKey: string
  ): Promise<InterpretationRunView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(request))
      .digest("hex");

    // 1. Verificación rápida de idempotencia en BD
    const existingRun = await this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "INTERPRETATION_RUN",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "La clave de idempotencia ya fue utilizada con una solicitud de interpretación diferente");
        }
        return existingReceipt.receiptPayload as unknown as InterpretationRunView;
      }
      return null;
    });

    if (existingRun) {
      return existingRun;
    }

    // 2. Transacción de lectura y preparación (corta)
    const { profile, draft, fragments } = await this.db.withActor(appUserId, async (tx) => {
      const prof = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!prof) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const activeDraft = await tx.profileRevision.findFirst({
        where: { profileId: prof.id, status: "DRAFT" },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      if (!activeDraft) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay borrador activo para el perfil");
      }

      if (activeDraft.revision !== ifMatchRev) {
        throw new AppError(412, "DRAFT_REVISION_CONFLICT", "El borrador cambió en otra sesión");
      }

      if (activeDraft.id !== request.draft_id) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "El ID del borrador no coincide");
      }

      // Validar grant
      const grantReceipts = await tx.operationReceipt.findMany({
        where: {
          actorUserId: appUserId,
          profileId: prof.id,
          operation: "INTERPRETATION_GRANT",
        },
      });

      const grantFound = grantReceipts.find((r) => {
        const payload = r.receiptPayload as any;
        return payload?.grant_id === request.grant_id;
      });

      if (!grantFound) {
        throw new AppError(422, "PROCESSING_GRANT_REQUIRED", "No se encontró la autorización requerida para procesar con IA");
      }

      const grantData = grantFound.receiptPayload as any;

      const revokeReceipts = await tx.operationReceipt.findMany({
        where: {
          actorUserId: appUserId,
          profileId: prof.id,
          operation: "REVOKE_GRANT",
        },
      });
      const isRevoked = revokeReceipts.some((r) => (r.receiptPayload as any)?.grant_id === request.grant_id);
      if (isRevoked || grantData.status === "REVOKED") {
        throw new AppError(422, "PROCESSING_GRANT_REQUIRED", "La autorización fue revocada previamente");
      }

      if (grantData.draft_revision !== activeDraft.revision) {
        throw new AppError(409, "STALE_INTERPRETATION", "La autorización corresponde a una versión desactualizada del borrador");
      }

      // Validar que las fuentes solicitadas coincidan exactamente con las autorizadas en el grant
      const authorizedSourceIds = new Set((grantData.source_refs || []).map((s: any) => s.id));
      for (const s of request.source_refs) {
        if (!authorizedSourceIds.has(s.id)) {
          throw new AppError(422, "PROCESSING_GRANT_REQUIRED", `La fuente ${s.id} no está autorizada en este consentimiento`);
        }
      }

      // Validar que ninguna fuente haya sido retirada ni esté en estado FAILED
      const sourceIds = request.source_refs.map((s) => s.id);
      const sources = await tx.profileSource.findMany({
        where: { id: { in: sourceIds }, profileId: prof.id },
      });
      for (const src of sources) {
        if (src.status === "WITHDRAWN") {
          throw new AppError(409, "SOURCE_WITHDRAWN", `La fuente ${src.id} fue retirada y no puede ser procesada`);
        }
        if (src.status === "FAILED") {
          throw new AppError(422, "SOURCE_HAS_NO_FRAGMENTS", `La fuente ${src.id} no contiene texto digital utilizable`);
        }
      }

      // Obtener fragmentos de las fuentes autorizadas
      const frags = await tx.sourceFragment.findMany({
        where: {
          profileId: prof.id,
          sourceId: { in: sourceIds },
        },
      });

      if (frags.length === 0) {
        throw new AppError(422, "SOURCE_HAS_NO_FRAGMENTS", "No se encontraron fragmentos de texto en las fuentes autorizadas");
      }

      return {
        profile: prof,
        draft: this.mapDraft(activeDraft),
        fragments: frags.map((f) => ({
          id: f.id,
          text: f.text,
          page: f.page,
          start_millis: f.startMillis,
          end_millis: f.endMillis,
        })),
      };
    });

    // 3. Invocación desacoplada de IA FUERA DE LA TRANSACCIÓN SQL
    const runId = randomUUID();
    const a02Result = await this.a02.interpretProfile({
      runId,
      actorUserId: appUserId,
      draft,
      fragments,
      goal: request.goal,
    });

    // 4. Transacción de persistencia del resultado y recibo (corta)
    return this.db.withActor(appUserId, async (tx) => {
      await tx.operationReceipt.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "INTERPRETATION_RUN",
          idempotencyKey,
          payloadHash,
          receiptPayload: a02Result.runView as any,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          caseId: "CU01",
          event: "PROFILE_INTERPRETATION_EXECUTED",
          reasonCode: a02Result.provider,
        },
      });

      return a02Result.runView;
    });
  }

  async getInterpretationRun(identity: VerifiedIdentity, runId: string): Promise<InterpretationRunView> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    return this.db.withActor(appUserId, async (tx) => {
      const receipts = await tx.operationReceipt.findMany({
        where: {
          actorUserId: appUserId,
          operation: "INTERPRETATION_RUN",
        },
      });

      const found = receipts.find((r) => {
        const payload = r.receiptPayload as any;
        return payload?.run_id === runId;
      });

      if (!found) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Ejecución de interpretación no encontrada");
      }

      return found.receiptPayload as unknown as InterpretationRunView;
    });
  }

  async applySuggestionBatch(
    identity: VerifiedIdentity,
    request: SuggestionBatchDecisionRequest,
    ifMatchRev: number,
    idempotencyKey: string
  ): Promise<SuggestionBatchDecisionResponse> {
    const appUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!appUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta aún no ha sido inicializada");
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(request))
      .digest("hex");

    return this.db.withActor(appUserId, async (tx) => {
      const existingReceipt = await tx.operationReceipt.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: appUserId,
            operation: "SUGGESTION_DECISIONS",
            idempotencyKey,
          },
        },
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash !== payloadHash) {
          throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "La clave de idempotencia ya fue utilizada con un lote de decisiones diferente");
        }
        return existingReceipt.receiptPayload as unknown as SuggestionBatchDecisionResponse;
      }

      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: appUserId },
      });
      if (!profile) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "Perfil no encontrado");
      }

      const draft = await tx.profileRevision.findFirst({
        where: { profileId: profile.id, status: "DRAFT" },
      });
      if (!draft) {
        throw new AppError(404, "RESOURCE_NOT_FOUND", "No hay borrador activo para el perfil");
      }

      if (draft.revision !== ifMatchRev) {
        throw new AppError(412, "DRAFT_REVISION_CONFLICT", "El borrador cambió en otra sesión");
      }

      let runView: InterpretationRunView | null = null;
      if (request.run_id) {
        const receipts = await tx.operationReceipt.findMany({
          where: {
            actorUserId: appUserId,
            profileId: profile.id,
            operation: "INTERPRETATION_RUN",
          },
        });
        const found = receipts.find((r) => (r.receiptPayload as any)?.run_id === request.run_id);
        if (!found) {
          throw new AppError(404, "RESOURCE_NOT_FOUND", "Ejecución de interpretación no encontrada");
        }
        runView = found.receiptPayload as unknown as InterpretationRunView;

        if (runView.draft_ref.revision !== draft.revision) {
          throw new AppError(409, "STALE_INTERPRETATION", "La interpretación corresponde a una versión anterior del borrador");
        }
      }

      let acceptedCount = 0;
      let rejectedCount = 0;
      let deferredCount = 0;

      let draftExpStatus = draft.experienceStatus;
      let draftTrnStatus = draft.trainingStatus;
      let draftIntStatus = draft.interestsStatus;

      const decisionIds = request.decisions.map((decision) => decision.suggestion_id || decision.claim_id);
      if (new Set(decisionIds).size !== decisionIds.length) {
        throw new AppError(400, "INVALID_REQUEST", "Cada dato debe tener una sola decisión.");
      }

      const acceptedRefs = [...new Set(request.decisions.filter((decision) => decision.decision === 'accept')
        .flatMap((decision) => runView?.suggestions.find((suggestion) => suggestion.suggestion_id === decision.suggestion_id)?.source_refs || []))];
      const sourceFragments = acceptedRefs.length ? await tx.sourceFragment.findMany({
        where: { id: { in: acceptedRefs }, profileId: profile.id }, include: { source: true },
      }) : [];
      if (sourceFragments.length !== acceptedRefs.length || sourceFragments.some((fragment) => fragment.source.status === 'WITHDRAWN')) {
        throw new AppError(409, "SOURCE_WITHDRAWN", "Una fuente de las propuestas fue retirada o ya no está disponible.");
      }
      const fragmentById = new Map(sourceFragments.map((fragment) => [fragment.id, fragment]));

      for (const dec of request.decisions) {
        if (dec.suggestion_id && !runView?.suggestions.some((suggestion) => suggestion.suggestion_id === dec.suggestion_id)) {
          throw new AppError(400, "INVALID_REQUEST", "Uno de los datos ya no pertenece a esta revisión.");
        }
        if (dec.decision === "reject") {
          rejectedCount++;
          continue;
        }
        if (dec.decision === "defer") {
          deferredCount++;
          continue;
        }

        // Decision es 'accept'
        acceptedCount++;

        if (dec.suggestion_id && runView) {
          const suggestion = runView.suggestions.find((s) => s.suggestion_id === dec.suggestion_id);
          if (!suggestion) continue;

          const schema = suggestion.section === "EXPERIENCE" ? ExperienceItemSchema
            : suggestion.section === "TRAINING" ? TrainingItemSchema
            : suggestion.section === "INTERESTS" ? InterestItemSchema : null;
          if (!schema) {
            throw new AppError(422, "UNSUPPORTED_PROPOSAL", "Esta sugerencia todavía debe revisarse antes de incorporarla al perfil.");
          }
          const parsedValue = schema.safeParse(dec.replacement_value ?? suggestion.proposed_value);
          if (!parsedValue.success) {
            const issues = parsedValue.error.issues.map((issue) => ({
              field: String(issue.path[0] || ''), message: profileProposalIssueMessage(String(issue.path[0] || '')),
            }));
            const raw = (dec.replacement_value ?? suggestion.proposed_value) as Record<string, unknown> | null;
            const label = String(raw?.title || raw?.name || raw?.original_text || 'Dato seleccionado').slice(0, 160);
            throw new AppError(400, "INVALID_PROPOSAL", `${label}: ${issues[0].message}`, false, issues);
          }
          const proposed = parsedValue.data as any;

          if (suggestion.section === "EXPERIENCE") {
            const exp = await tx.profileExperience.create({
              data: {
                id: randomUUID(),
                profileId: profile.id,
                revisionId: draft.id,
                kind: (proposed.kind || "INFORMAL") as any,
                title: proposed.title,
                organizationName: proposed.organization_name || null,
                description: proposed.description || proposed.title,
                startMonth: proposed.start_month || null,
                endMonth: proposed.end_month || null,
                ongoing: Boolean(proposed.ongoing),
              },
            });

            draftExpStatus = "PROVIDED";

            // Vincular evidencia con el fragmento de origen
            const refFragId = suggestion.source_refs[0];
            if (refFragId) {
              const fragment = fragmentById.get(refFragId);
              if (fragment) {
                const evidence = await tx.profileEvidence.create({
                  data: {
                    id: randomUUID(),
                    profileId: profile.id,
                    fragmentId: fragment.id,
                    kind: "DOCUMENT",
                    scope: "Evidencia de experiencia procesada por A02",
                  },
                });
                await tx.profileEvidenceLink.create({
                  data: {
                    id: randomUUID(),
                    profileId: profile.id,
                    revisionId: draft.id,
                    evidenceId: evidence.id,
                    experienceId: exp.id,
                  },
                });
              }
            }
          } else if (suggestion.section === "TRAINING") {
            const trn = await tx.trainingDeclaration.create({
              data: {
                id: randomUUID(),
                profileId: profile.id,
                revisionId: draft.id,
                name: proposed.name,
                providerName: proposed.provider_name || null,
                completedOn: proposed.completed_on ? new Date(proposed.completed_on) : null,
              },
            });

            draftTrnStatus = "PROVIDED";

            const refFragId = suggestion.source_refs[0];
            if (refFragId) {
              const fragment = fragmentById.get(refFragId);
              if (fragment) {
                const evidence = await tx.profileEvidence.create({
                  data: {
                    id: randomUUID(),
                    profileId: profile.id,
                    fragmentId: fragment.id,
                    kind: "DOCUMENT",
                    scope: "Evidencia de formación procesada por A02",
                  },
                });
                await tx.profileEvidenceLink.create({
                  data: {
                    id: randomUUID(),
                    profileId: profile.id,
                    revisionId: draft.id,
                    evidenceId: evidence.id,
                    trainingId: trn.id,
                  },
                });
              }
            }
          } else if (suggestion.section === "INTERESTS") {
            await tx.jobInterest.create({
              data: {
                id: randomUUID(),
                profileId: profile.id,
                revisionId: draft.id,
                originalText: proposed.original_text,
              },
            });
            draftIntStatus = "PROVIDED";
          }
        }
      }

      // Incrementar revisión en exactamente 1 tras aplicar el lote atómico
      const updatedDraft = await tx.profileRevision.update({
        where: { id: draft.id },
        data: {
          revision: draft.revision + 1,
          experienceStatus: draftExpStatus as any,
          trainingStatus: draftTrnStatus as any,
          interestsStatus: draftIntStatus as any,
          updatedAt: new Date(),
        },
        include: DRAFT_CHILDREN_INCLUDE,
      });

      const receiptId = randomUUID();
      const responsePayload: SuggestionBatchDecisionResponse = {
        receipt_id: receiptId,
        draft: this.mapDraft(updatedDraft),
        new_revision: updatedDraft.revision,
        accepted_count: acceptedCount,
        rejected_count: rejectedCount,
        deferred_count: deferredCount,
      };

      await tx.operationReceipt.create({
        data: {
          id: receiptId,
          actorUserId: appUserId,
          profileId: profile.id,
          operation: "SUGGESTION_DECISIONS",
          idempotencyKey,
          payloadHash,
          receiptPayload: responsePayload as any,
        },
      });

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId: appUserId,
          profileId: profile.id,
          revisionId: draft.id,
          operationId: receiptId,
          caseId: "CU01",
          event: "SUGGESTION_DECISIONS_APPLIED",
          reasonCode: "BATCH_CONFIRMATION",
        },
      });

      return responsePayload;
    }, { timeout: 30000, maxWait: 8000 });
  }
}

