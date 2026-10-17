import { z } from "zod";

export const EmptyBodySchema = z.object({}).strict();

export const IdSchema = z.string().uuid();

export const CredentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
}).strict();

export const PasswordResetSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();

export const UpdatePasswordSchema = z.object({
  password: z.string().min(8).max(128),
}).strict();

export const ApiFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const ApiErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  field_errors: z.array(ApiFieldErrorSchema),
  retryable: z.boolean(),
});

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorPayloadSchema,
  request_id: z.string(),
});

export type ApiFieldError = z.infer<typeof ApiFieldErrorSchema>;
export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export interface DataEnvelope<T> {
  data: T;
  request_id: string;
}

export const OrganizationTypeSchema = z.enum(["COMPANY", "TRAINING_CENTER"]);
export type OrganizationType = z.infer<typeof OrganizationTypeSchema>;

export const MembershipRoleSchema = z.enum(["ADMIN", "RECRUITER", "TRAINING_MANAGER"]);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const OrganizationSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: OrganizationTypeSchema,
});
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;

export const OrganizationContextViewSchema = z.object({
  organization: OrganizationSummarySchema,
  role: MembershipRoleSchema,
  membership_id: z.string().uuid(),
});
export type OrganizationContextView = z.infer<typeof OrganizationContextViewSchema>;

export const MeUserSchema = z.object({
  id: z.string().uuid(),
  auth_subject: z.string().uuid(),
  status: z.literal("ACTIVE"),
  locale: z.string(),
  theme: z.string(),
});
export type MeUser = z.infer<typeof MeUserSchema>;

export const MeCandidateProfileSchema = z.object({
  id: z.string().uuid(),
  current_version_id: z.string().uuid().nullable(),
});
export type MeCandidateProfile = z.infer<typeof MeCandidateProfileSchema>;

export const MeViewSchema = z.object({
  user: MeUserSchema,
  email: z.string().email(),
  profile: MeCandidateProfileSchema.nullable(),
  contexts: z.array(OrganizationContextViewSchema),
  counselor: z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    display_name: z.string(),
    specialty: z.string(),
  }).nullable().optional(),
});
export type MeView = z.infer<typeof MeViewSchema>;

export const RevisionStatusSchema = z.enum(["DRAFT", "CONFIRMED", "DISCARDED"]);
export type RevisionStatus = z.infer<typeof RevisionStatusSchema>;

export const DeclarationStatusSchema = z.enum(["UNKNOWN", "NONE", "PROVIDED"]);
export type DeclarationStatus = z.infer<typeof DeclarationStatusSchema>;

export const KnowledgeStateSchema = z.enum(["UNKNOWN", "KNOWN"]);
export type KnowledgeState = z.infer<typeof KnowledgeStateSchema>;

export const MobilityModeSchema = z.enum([
  "BUS",
  "METRO",
  "WALKING",
  "BICYCLE",
  "PRIVATE_VEHICLE",
  "OTHER"
]);
export type MobilityMode = z.infer<typeof MobilityModeSchema>;

export const MoneyPeriodSchema = z.enum([
  "HOUR",
  "DAY",
  "WEEK",
  "MONTH",
  "TOTAL"
]);
export type MoneyPeriod = z.infer<typeof MoneyPeriodSchema>;

export const ProfileSectionSchema = z.enum([
  "ACCOUNT",
  "EXPERIENCE",
  "TRAINING",
  "INTERESTS",
  "COMPETENCIES",
  "AVAILABILITY",
  "CONSTRAINTS",
  "FINAL_REVIEW"
]);
export type ProfileSection = z.infer<typeof ProfileSectionSchema>;

export const ReviewDecisionSchema = z.enum(["REVIEWED", "DEFERRED"]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ExperienceKindSchema = z.enum([
  "FORMAL",
  "INFORMAL",
  "VOLUNTEER",
  "PERSONAL_PROJECT",
  "OTHER"
]);
export type ExperienceKind = z.infer<typeof ExperienceKindSchema>;

export const ExperienceItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: ExperienceKindSchema,
  title: z.string().trim().min(1).max(120),
  organization_name: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().min(1).max(3000),
  start_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato mes/año YYYY-MM").nullable().optional(),
  end_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato mes/año YYYY-MM").nullable().optional(),
  ongoing: z.boolean().default(false),
}).refine((data) => {
  if (data.ongoing && data.end_month) return false;
  if (data.start_month && data.end_month && data.start_month > data.end_month) return false;
  return true;
}, {
  message: "Fechas de experiencia inválidas: end_month no puede ser anterior a start_month ni coexistir con ongoing=true",
  path: ["end_month"],
});
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;

export const TrainingItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  provider_name: z.string().trim().max(160).nullable().optional(),
  completed_on: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Formato fecha YYYY-MM-DD").nullable().optional(),
}).refine((data) => {
  if (data.completed_on) {
    const today = new Date().toISOString().slice(0, 10);
    if (data.completed_on > today) return false;
  }
  return true;
}, {
  message: "La fecha de finalización no puede ser futura",
  path: ["completed_on"],
});
export type TrainingItem = z.infer<typeof TrainingItemSchema>;

export const InterestItemSchema = z.object({
  id: z.string().uuid().optional(),
  original_text: z.string().trim().min(1).max(160),
  occupation_id: z.string().uuid().nullable().optional(),
  catalog_version_id: z.string().uuid().nullable().optional(),
});
export type InterestItem = z.infer<typeof InterestItemSchema>;

export function profileProposalIssueMessage(field: string): string {
  const messages: Record<string, string> = {
    kind: 'Selecciona el tipo de experiencia.',
    title: 'Escribe una actividad o puesto de hasta 120 caracteres.',
    name: 'Escribe el nombre del estudio o curso de hasta 160 caracteres.',
    description: 'Describe qué hacías (hasta 3000 caracteres).',
    organization_name: 'El lugar de la experiencia debe tener hasta 160 caracteres.',
    provider_name: 'El centro de formación debe tener hasta 160 caracteres.',
    start_month: 'Corrige el mes de inicio o déjalo pendiente.',
    end_month: 'Corrige el mes de fin: debe ser posterior o igual al inicio y quedar vacío si continúas. También puedes dejar las fechas pendientes.',
    ongoing: 'Indica si continúas con esta actividad.',
    completed_on: 'Corrige la fecha de finalización (día, mes y año, sin fecha futura) o déjala pendiente.',
    original_text: 'Escribe un área de interés de hasta 160 caracteres.',
    occupation_id: 'Deja el puesto normalizado pendiente si no está en el catálogo.',
    catalog_version_id: 'Deja el catálogo pendiente si no está disponible.',
  };
  return messages[field] || 'Revisa este dato antes de añadirlo.';
}

export function getProfileProposalIssues(section: string, value: unknown): { field: string; message: string }[] {
  const schema = section === 'EXPERIENCE' ? ExperienceItemSchema
    : section === 'TRAINING' ? TrainingItemSchema : section === 'INTERESTS' ? InterestItemSchema : null;
  if (!schema) return [];
  const parsed = schema.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((issue) => ({
    field: String(issue.path[0] || ''), message: profileProposalIssueMessage(String(issue.path[0] || '')),
  }));
}

export const AvailabilityWindowViewSchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(1).max(7),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  timezone: z.string().default("America/Panama"),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato fecha YYYY-MM-DD"),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato fecha YYYY-MM-DD"),
}).refine((w) => w.start_minute < w.end_minute, {
  message: "start_minute debe ser menor que end_minute",
  path: ["end_minute"],
}).refine((w) => w.valid_from <= w.valid_to, {
  message: "valid_from debe ser menor o igual a valid_to",
  path: ["valid_to"],
});
export type AvailabilityWindowView = z.infer<typeof AvailabilityWindowViewSchema>;

export const ProfileConstraintsValuesSchema = z.object({
  location_state: KnowledgeStateSchema.default("UNKNOWN"),
  approximate_zone: z.string().trim().max(160).nullable().optional(),
  availability_state: KnowledgeStateSchema.default("UNKNOWN"),
  mobility_state: KnowledgeStateSchema.default("UNKNOWN"),
  mobility_modes: z.array(MobilityModeSchema).default([]),
  travel_limit_state: KnowledgeStateSchema.default("UNKNOWN"),
  max_one_way_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  salary_state: KnowledgeStateSchema.default("UNKNOWN"),
  minimum_salary: z.string().regex(/^\d+(\.\d{2})?$/, "Monto monetario con hasta 2 decimales").nullable().optional(),
  salary_currency: z.string().length(3).nullable().optional(),
  salary_period: MoneyPeriodSchema.nullable().optional(),
  transport_state: KnowledgeStateSchema.default("UNKNOWN"),
  transport_budget: z.string().regex(/^\d+(\.\d{2})?$/, "Monto monetario con hasta 2 decimales").nullable().optional(),
  transport_currency: z.string().length(3).nullable().optional(),
  transport_period: MoneyPeriodSchema.nullable().optional(),
  training_state: KnowledgeStateSchema.default("UNKNOWN"),
  training_budget: z.string().regex(/^\d+(\.\d{2})?$/, "Monto monetario con hasta 2 decimales").nullable().optional(),
  training_currency: z.string().length(3).nullable().optional(),
  training_period: MoneyPeriodSchema.nullable().optional(),
}).refine((data) => {
  if (data.location_state === "KNOWN" && (!data.approximate_zone || data.approximate_zone.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "approximate_zone es obligatorio si location_state es KNOWN",
  path: ["approximate_zone"],
}).refine((data) => {
  if (data.mobility_state === "KNOWN" && data.mobility_modes.length === 0) {
    return false;
  }
  return true;
}, {
  message: "Debe seleccionarse al menos un modo de movilidad si mobility_state es KNOWN",
  path: ["mobility_modes"],
}).refine((data) => {
  if (data.travel_limit_state === "KNOWN" && (data.max_one_way_minutes === null || data.max_one_way_minutes === undefined)) {
    return false;
  }
  return true;
}, {
  message: "max_one_way_minutes es obligatorio si travel_limit_state es KNOWN (0 es válido)",
  path: ["max_one_way_minutes"],
}).refine((data) => {
  if (data.salary_state === "KNOWN" && (!data.minimum_salary || !data.salary_currency || !data.salary_period)) {
    return false;
  }
  return true;
}, {
  message: "minimum_salary, salary_currency y salary_period son requeridos si salary_state es KNOWN",
  path: ["minimum_salary"],
});
export type ProfileConstraintsValues = z.infer<typeof ProfileConstraintsValuesSchema>;

export const ProfileDraftViewSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  base_version_id: z.string().uuid().nullable(),
  status: RevisionStatusSchema,
  revision: z.number().int().positive(),
  version_number: z.number().int().nullable(),
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  experience_status: DeclarationStatusSchema,
  training_status: DeclarationStatusSchema,
  interests_status: DeclarationStatusSchema,
  experiences: z.array(ExperienceItemSchema).optional().default([]),
  trainings: z.array(TrainingItemSchema).optional().default([]),
  interests: z.array(InterestItemSchema).optional().default([]),
  windows: z.array(AvailabilityWindowViewSchema).optional().default([]),
  constraints: ProfileConstraintsValuesSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProfileDraftView = z.infer<typeof ProfileDraftViewSchema>;


export const CandidateProfileViewSchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  current_version_id: z.string().uuid().nullable(),
  active_draft: ProfileDraftViewSchema.nullable(),
  current_version: ProfileDraftViewSchema.nullable().optional(),
});
export type CandidateProfileView = z.infer<typeof CandidateProfileViewSchema>;

export const CreateDraftRequestSchema = z.object({
  base_version_id: z.string().uuid().nullable().optional(),
}).strict();
export type CreateDraftRequest = z.infer<typeof CreateDraftRequestSchema>;

export const ProfileDraftIdentityValuesSchema = z.object({
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  headline: z.string().trim().max(160).nullable().optional(),
}).strict();
export type ProfileDraftIdentityValues = z.infer<typeof ProfileDraftIdentityValuesSchema>;

export const PatchDraftIdentityRequestSchema = z.object({
  section: z.literal("identity"),
  values: ProfileDraftIdentityValuesSchema,
}).strict();
export type PatchDraftIdentityRequest = z.infer<typeof PatchDraftIdentityRequestSchema>;


export const PatchDraftExperienceRequestSchema = z.object({
  section: z.literal("experience"),
  values: z.object({
    status: DeclarationStatusSchema.optional(),
    items: z.array(ExperienceItemSchema).max(30),
  }).refine((v) => {
    if (v.status === "NONE" && v.items.length > 0) return false;
    return true;
  }, {
    message: "El estado NONE exige un array vacío de experiencias",
    path: ["items"],
  }),
}).strict();
export type PatchDraftExperienceRequest = z.infer<typeof PatchDraftExperienceRequestSchema>;

export const PatchDraftTrainingRequestSchema = z.object({
  section: z.literal("training"),
  values: z.object({
    status: DeclarationStatusSchema.optional(),
    items: z.array(TrainingItemSchema).max(30),
  }).refine((v) => {
    if (v.status === "NONE" && v.items.length > 0) return false;
    return true;
  }, {
    message: "El estado NONE exige un array vacío de formación",
    path: ["items"],
  }),
}).strict();
export type PatchDraftTrainingRequest = z.infer<typeof PatchDraftTrainingRequestSchema>;

export const PatchDraftInterestsRequestSchema = z.object({
  section: z.literal("interests"),
  values: z.object({
    status: DeclarationStatusSchema.optional(),
    items: z.array(InterestItemSchema).max(20),
  }).refine((v) => {
    if (v.status === "NONE" && v.items.length > 0) return false;
    return true;
  }, {
    message: "El estado NONE exige un array vacío de intereses",
    path: ["items"],
  }),
}).strict();
export type PatchDraftInterestsRequest = z.infer<typeof PatchDraftInterestsRequestSchema>;

export const SectionReviewRequestSchema = z.object({
  section: ProfileSectionSchema,
  decision: ReviewDecisionSchema,
}).strict();
export type SectionReviewRequest = z.infer<typeof SectionReviewRequestSchema>;

export const PatchDraftAvailabilityRequestSchema = z.object({
  section: z.literal("availability"),
  values: z.object({
    windows: z.array(AvailabilityWindowViewSchema).max(30),
  }),
}).strict();
export type PatchDraftAvailabilityRequest = z.infer<typeof PatchDraftAvailabilityRequestSchema>;

export const PatchDraftConstraintsRequestSchema = z.object({
  section: z.literal("constraints"),
  values: ProfileConstraintsValuesSchema,
}).strict();
export type PatchDraftConstraintsRequest = z.infer<typeof PatchDraftConstraintsRequestSchema>;

export const ReviewPreviewRequestSchema = z.object({}).strict();
export type ReviewPreviewRequest = z.infer<typeof ReviewPreviewRequestSchema>;

export const MissingFieldItemSchema = z.object({
  section: ProfileSectionSchema,
  field: z.string(),
  message: z.string(),
  severity: z.enum(["INFO", "WARNING"]),
});
export type MissingFieldItem = z.infer<typeof MissingFieldItemSchema>;

export const ProfileSnapshotSummarySchema = z.object({
  display_name: z.string().nullable(),
  headline: z.string().nullable(),
  experience_status: DeclarationStatusSchema,
  experiences_count: z.number().int(),
  training_status: DeclarationStatusSchema,
  trainings_count: z.number().int(),
  interests_status: DeclarationStatusSchema,
  interests_count: z.number().int(),
  availability_windows_count: z.number().int(),
  location_state: KnowledgeStateSchema,
  approximate_zone: z.string().nullable(),
  mobility_modes: z.array(MobilityModeSchema),
  max_one_way_minutes: z.number().nullable(),
  salary_state: KnowledgeStateSchema,
  minimum_salary: z.string().nullable(),
  transport_budget: z.string().nullable(),
  training_budget: z.string().nullable(),
});
export type ProfileSnapshotSummary = z.infer<typeof ProfileSnapshotSummarySchema>;

export const ReviewPreviewResponseSchema = z.object({
  preview_id: z.string().uuid(),
  draft_id: z.string().uuid(),
  draft_revision: z.number().int(),
  snapshot_digest: z.string().length(64),
  acknowledge_partial_required: z.boolean(),
  expires_at: z.string(),
  missing_fields: z.array(MissingFieldItemSchema),
  summary: ProfileSnapshotSummarySchema,
});
export type ReviewPreviewResponse = z.infer<typeof ReviewPreviewResponseSchema>;

export const ConfirmProfileRequestSchema = z.object({
  draft_id: z.string().uuid(),
  preview_id: z.string().uuid(),
  acknowledge_partial: z.boolean().default(false),
}).strict();
export type ConfirmProfileRequest = z.infer<typeof ConfirmProfileRequestSchema>;

export const ProfileConfirmationReceiptSchema = z.object({
  receipt_id: z.string().uuid(),
  confirmation_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  version_id: z.string().uuid(),
  version_number: z.number().int(),
  confirmed_at: z.string(),
  snapshot_digest: z.string().length(64),
  acknowledged_partial: z.boolean(),
});
export type ProfileConfirmationReceipt = z.infer<typeof ProfileConfirmationReceiptSchema>;

// D2-B y D2-C: Fuentes documentales, procesamiento y agente A02
export const SourceKindSchema = z.enum(["MANUAL_TEXT", "PDF", "IMAGE", "AUDIO"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceStatusSchema = z.enum(["RECEIVED", "VALIDATED", "READY", "FAILED", "WITHDRAWN"]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const SourceRefSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
}).strict();
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const SourceFragmentViewSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  page: z.number().int().positive().nullable(),
  start_millis: z.number().int().nonnegative().nullable(),
  end_millis: z.number().int().positive().nullable(),
});
export type SourceFragmentView = z.infer<typeof SourceFragmentViewSchema>;

export const ProfileSourceViewSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  kind: SourceKindSchema,
  status: SourceStatusSchema,
  version: z.number().int().positive(),
  sha256: z.string().length(64),
  media_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  fragments_count: z.number().int().nonnegative(),
  fragments: z.array(SourceFragmentViewSchema).optional(),
  created_at: z.string(),
});
export type ProfileSourceView = z.infer<typeof ProfileSourceViewSchema>;

export const CreateManualTextSourceRequestSchema = z.object({
  kind: z.literal("manual_text"),
  text: z.string().trim().min(1).max(20000),
}).strict();
export type CreateManualTextSourceRequest = z.infer<typeof CreateManualTextSourceRequestSchema>;

export const WithdrawSourceRequestSchema = z.object({
  reason: z.string().max(200).optional(),
}).strict();
export type WithdrawSourceRequest = z.infer<typeof WithdrawSourceRequestSchema>;

export const InterpretationGrantRequestSchema = z.object({
  source_refs: z.array(SourceRefSchema).min(1).max(20),
  draft_revision: z.number().int().positive(),
  purpose: z.literal("profile_interpretation"),
  provider: z.literal("vertex"),
}).strict();
export type InterpretationGrantRequest = z.infer<typeof InterpretationGrantRequestSchema>;

export const InterpretationGrantViewSchema = z.object({
  grant_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  status: z.enum(["ACTIVE", "REVOKED", "CONSUMED"]),
  source_refs: z.array(SourceRefSchema),
  draft_revision: z.number().int().positive(),
  purpose: z.string(),
  provider: z.string(),
  created_at: z.string(),
});
export type InterpretationGrantView = z.infer<typeof InterpretationGrantViewSchema>;

export const ProfileInterpretationRequestSchema = z.object({
  draft_id: z.string().uuid(),
  source_refs: z.array(SourceRefSchema).min(1).max(20),
  grant_id: z.string().uuid(),
  goal: z.enum(["build_profile", "clarify_profile"]),
}).strict();
export type ProfileInterpretationRequest = z.infer<typeof ProfileInterpretationRequestSchema>;

export const InterpretationSuggestionSchema = z.object({
  suggestion_id: z.string().uuid(),
  section: ProfileSectionSchema,
  field: z.string(),
  proposed_value: z.unknown(),
  source_refs: z.array(z.string()),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type InterpretationSuggestion = z.infer<typeof InterpretationSuggestionSchema>;

export const InterpretationRunViewSchema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "stale"]),
  agent_id: z.literal("A02"),
  contract_version: z.literal("agent-result/1"),
  goal: z.enum(["build_profile", "clarify_profile"]),
  draft_ref: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
  }),
  suggestions: z.array(InterpretationSuggestionSchema),
  missing_fields: z.array(z.string()),
  questions: z.array(z.object({ field: z.string(), text: z.string() })),
  created_at: z.string(),
});
export type InterpretationRunView = z.infer<typeof InterpretationRunViewSchema>;

export const SuggestionDecisionItemSchema = z.object({
  suggestion_id: z.string().uuid().optional(),
  claim_id: z.string().uuid().optional(),
  decision: z.enum(["accept", "reject", "defer"]),
  replacement_value: z.unknown().optional(),
}).strict().refine((data) => (data.suggestion_id ? 1 : 0) + (data.claim_id ? 1 : 0) === 1, {
  message: "Debe especificarse exactamente suggestion_id o claim_id",
});
export type SuggestionDecisionItem = z.infer<typeof SuggestionDecisionItemSchema>;

export const SuggestionBatchDecisionRequestSchema = z.object({
  run_id: z.string().uuid().nullable(),
  decisions: z.array(SuggestionDecisionItemSchema).min(1).max(50),
}).strict();
export type SuggestionBatchDecisionRequest = z.infer<typeof SuggestionBatchDecisionRequestSchema>;

export const SuggestionBatchDecisionResponseSchema = z.object({
  receipt_id: z.string().uuid(),
  draft: ProfileDraftViewSchema,
  new_revision: z.number().int().positive(),
  accepted_count: z.number().int().nonnegative(),
  rejected_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
});
export type SuggestionBatchDecisionResponse = z.infer<typeof SuggestionBatchDecisionResponseSchema>;

// =============================================================================
// D3: Explorar oportunidades, comparación determinística C01 y agente A03
// =============================================================================

export const CompetencyKindSchema = z.enum(["KNOWLEDGE", "SKILL"]);
export type CompetencyKind = z.infer<typeof CompetencyKindSchema>;

export const WorkplaceTypeSchema = z.enum(["REMOTE", "ON_SITE", "HYBRID"]);
export type WorkplaceType = z.infer<typeof WorkplaceTypeSchema>;

export const RequirementTypeSchema = z.enum(["ESSENTIAL", "DESIRABLE"]);
export type RequirementType = z.infer<typeof RequirementTypeSchema>;

export const RequirementStageSchema = z.enum(["ENTRY", "TRAINABLE"]);
export type RequirementStage = z.infer<typeof RequirementStageSchema>;

export const ComparisonFeasibilitySchema = z.enum(["VIABLE", "INVIABLE", "PENDIENTE"]);
export type ComparisonFeasibility = z.infer<typeof ComparisonFeasibilitySchema>;

export const RequirementEvaluationStatusSchema = z.enum(["CUMPLE", "NO_CUMPLE", "DESCONOCIDO"]);
export type RequirementEvaluationStatus = z.infer<typeof RequirementEvaluationStatusSchema>;

export const OpportunitySummaryViewSchema = z.object({
  id: z.string().uuid(),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  title: z.string(),
  occupation: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }),
  workplace_type: WorkplaceTypeSchema,
  location: z.string(),
  salary_amount: z.string().nullable(),
  salary_currency: z.string().nullable(),
  salary_period: MoneyPeriodSchema.nullable(),
  schedule_summary: z.string().nullable(),
  available_slots: z.number().int(),
  is_demo: z.boolean(),
  version: z.number().int().positive(),
  published_at: z.string(),
});
export type OpportunitySummaryView = z.infer<typeof OpportunitySummaryViewSchema>;

export const OpportunityRequirementViewSchema = z.object({
  id: z.string().uuid(),
  competency_id: z.string().uuid(),
  competency_name: z.string(),
  competency_kind: CompetencyKindSchema.optional().default("SKILL"),
  requirement_type: RequirementTypeSchema,
  stage: RequirementStageSchema,
  description: z.string(),
});
export type OpportunityRequirementView = z.infer<typeof OpportunityRequirementViewSchema>;

export const OpportunityDetailViewSchema = z.object({
  id: z.string().uuid(),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  title: z.string(),
  description: z.string(),
  occupation: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  workplace_type: WorkplaceTypeSchema,
  location: z.string(),
  salary_amount: z.string().nullable(),
  salary_currency: z.string().nullable(),
  salary_period: MoneyPeriodSchema.nullable(),
  schedule_summary: z.string().nullable(),
  available_slots: z.number().int(),
  is_demo: z.boolean(),
  version: z.number().int().positive(),
  published_at: z.string(),
  requirements: z.array(OpportunityRequirementViewSchema),
});
export type OpportunityDetailView = z.infer<typeof OpportunityDetailViewSchema>;

export const OpportunitiesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  occupation_id: z.string().uuid().optional(),
  workplace_type: WorkplaceTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type OpportunitiesQuery = z.infer<typeof OpportunitiesQuerySchema>;

export const OpportunityComparisonAssumptionsSchema = z.object({
  commute_minutes: z.number().int().min(0).max(1440).optional(),
  transport_mode: MobilityModeSchema.optional(),
}).strict();
export type OpportunityComparisonAssumptions = z.infer<typeof OpportunityComparisonAssumptionsSchema>;

export const CreateOpportunityComparisonRequestSchema = z.object({
  opportunity_id: z.string().uuid(),
  assumptions: OpportunityComparisonAssumptionsSchema.optional(),
}).strict();
export type CreateOpportunityComparisonRequest = z.infer<typeof CreateOpportunityComparisonRequestSchema>;

export const LogisticsSalaryEvaluationSchema = z.object({
  status: RequirementEvaluationStatusSchema,
  candidate_minimum: z.string().nullable(),
  opportunity_offered: z.string().nullable(),
  currency: z.string().nullable(),
  period: MoneyPeriodSchema.nullable(),
  reason: z.string(),
});
export type LogisticsSalaryEvaluation = z.infer<typeof LogisticsSalaryEvaluationSchema>;

export const LogisticsCommuteEvaluationSchema = z.object({
  status: RequirementEvaluationStatusSchema,
  candidate_max_minutes: z.number().int().nullable(),
  assumed_minutes: z.number().int().nullable(),
  reason: z.string(),
});
export type LogisticsCommuteEvaluation = z.infer<typeof LogisticsCommuteEvaluationSchema>;

export const LogisticsScheduleEvaluationSchema = z.object({
  status: RequirementEvaluationStatusSchema,
  reason: z.string(),
});
export type LogisticsScheduleEvaluation = z.infer<typeof LogisticsScheduleEvaluationSchema>;

export const LogisticsBreakdownSchema = z.object({
  salary: LogisticsSalaryEvaluationSchema,
  commute: LogisticsCommuteEvaluationSchema,
  schedule: LogisticsScheduleEvaluationSchema,
});
export type LogisticsBreakdown = z.infer<typeof LogisticsBreakdownSchema>;

export const RequirementComparisonItemSchema = z.object({
  requirement_id: z.string().uuid(),
  competency_id: z.string().uuid(),
  competency_name: z.string(),
  requirement_type: RequirementTypeSchema,
  stage: RequirementStageSchema,
  status: RequirementEvaluationStatusSchema,
  evidence_reason: z.string(),
});
export type RequirementComparisonItem = z.infer<typeof RequirementComparisonItemSchema>;

export const ComparisonBreakdownSchema = z.object({
  logistics: LogisticsBreakdownSchema,
  requirements: z.array(RequirementComparisonItemSchema),
});
export type ComparisonBreakdown = z.infer<typeof ComparisonBreakdownSchema>;

export const OpportunityComparisonViewSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  revision_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  opportunity_version: z.number().int().positive(),
  status: ComparisonFeasibilitySchema,
  coverage_numerator: z.number().int().nonnegative(),
  coverage_denominator: z.number().int().nonnegative(),
  coverage_percent: z.number().nullable(),
  assumptions: OpportunityComparisonAssumptionsSchema.nullable().optional(),
  breakdown: ComparisonBreakdownSchema,
  reasons: z.array(z.string()),
  outdated: z.boolean(),
  created_at: z.string(),
});
export type OpportunityComparisonView = z.infer<typeof OpportunityComparisonViewSchema>;

export const ExplanationAnswerItemSchema = z.object({
  field: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(500),
}).strict();
export type ExplanationAnswerItem = z.infer<typeof ExplanationAnswerItemSchema>;

export const CreateOpportunityExplanationRequestSchema = z.object({
  consent: z.literal(true),
  answers: z.array(ExplanationAnswerItemSchema).max(10).optional().default([]),
}).strict();
export type CreateOpportunityExplanationRequest = z.infer<typeof CreateOpportunityExplanationRequestSchema>;

export const OpportunityExplanationDecisionSchema = z.object({
  code: z.string(),
  feasibility: ComparisonFeasibilitySchema,
  reasons: z.array(z.string()),
});
export type OpportunityExplanationDecision = z.infer<typeof OpportunityExplanationDecisionSchema>;

export const OpportunityExplanationViewSchema = z.object({
  id: z.string().uuid(),
  comparison_id: z.string().uuid(),
  agent_id: z.literal("A03"),
  contract_version: z.literal("agent-result/1"),
  status: z.enum(["completed", "needs_input", "blocked", "error"]),
  summary: z.string(),
  decision: OpportunityExplanationDecisionSchema,
  missing_fields: z.array(z.string()),
  questions: z.array(z.object({ field: z.string(), text: z.string() })),
  created_at: z.string(),
});
export type OpportunityExplanationView = z.infer<typeof OpportunityExplanationViewSchema>;

// Tool Schemas para A03
export const ReadConfirmedProfileToolArgsSchema = z.object({
  profile_id: z.string().uuid(),
  revision_id: z.string().uuid(),
}).strict();
export type ReadConfirmedProfileToolArgs = z.infer<typeof ReadConfirmedProfileToolArgsSchema>;

export const ReadVacancyToolArgsSchema = z.object({
  opportunity_id: z.string().uuid(),
}).strict();
export type ReadVacancyToolArgs = z.infer<typeof ReadVacancyToolArgsSchema>;

export const EvaluateCompatibilityToolArgsSchema = z.object({
  opportunity_id: z.string().uuid(),
  assumptions: OpportunityComparisonAssumptionsSchema.optional(),
}).strict();
export type EvaluateCompatibilityToolArgs = z.infer<typeof EvaluateCompatibilityToolArgsSchema>;

export const ReadComparisonTraceToolArgsSchema = z.object({
  comparison_id: z.string().uuid(),
}).strict();
export type ReadComparisonTraceToolArgs = z.infer<typeof ReadComparisonTraceToolArgsSchema>;

export const SubmitExplanationToolArgsSchema = z.object({
  status: z.enum(["completed", "needs_input", "blocked"]),
  summary: z.string().max(1000),
  decision_code: z.string(),
  reasons: z.array(z.string()),
  missing_fields: z.array(z.string()),
  questions: z.array(z.object({ field: z.string(), text: z.string() })).max(3),
}).strict();
export type SubmitExplanationToolArgs = z.infer<typeof SubmitExplanationToolArgsSchema>;

// =============================================================================
// D4: Cursos, Planificador C01, Agente A05, Reservas y Agenda
// =============================================================================

export const PlanFeasibilitySchema = z.enum(["VIABLE", "CONDITIONAL", "PENDING", "INVIABLE"]);
export type PlanFeasibility = z.infer<typeof PlanFeasibilitySchema>;

export const LearningPlanStatusSchema = z.enum(["DRAFT", "CALCULATED", "CONFIRMED", "SUPERSEDED", "CANCELLED"]);
export type LearningPlanStatus = z.infer<typeof LearningPlanStatusSchema>;

export const PlanStepTypeSchema = z.enum(["DIRECT", "CONDITIONAL"]);
export type PlanStepType = z.infer<typeof PlanStepTypeSchema>;

export const ReservationStatusSchema = z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]);
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

export const CourseSessionViewSchema = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(1).max(7),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  timezone: z.string().default("America/Panama"),
  location: z.string().nullable().optional(),
});
export type CourseSessionView = z.infer<typeof CourseSessionViewSchema>;

export const CourseEditionViewSchema = z.object({
  id: z.string().uuid(),
  modality: WorkplaceTypeSchema,
  location: z.string().nullable().optional(),
  start_date: z.string(),
  end_date: z.string(),
  total_slots: z.number().int().positive(),
  available_slots: z.number().int().nonnegative(),
  cost_amount: z.string().nullable().optional(),
  cost_currency: z.string().nullable().optional(),
  cost_period: MoneyPeriodSchema.nullable().optional(),
  schedule_summary: z.string(),
  sessions: z.array(CourseSessionViewSchema),
  active: z.boolean(),
  version: z.number().int().positive(),
  published_at: z.string(),
});
export type CourseEditionView = z.infer<typeof CourseEditionViewSchema>;

export const CourseLearningOutcomeViewSchema = z.object({
  id: z.string().uuid(),
  competency_id: z.string().uuid(),
  competency_name: z.string().optional(),
  description: z.string(),
});
export type CourseLearningOutcomeView = z.infer<typeof CourseLearningOutcomeViewSchema>;

export const CoursePrerequisiteViewSchema = z.object({
  id: z.string().uuid(),
  competency_id: z.string().uuid(),
  competency_name: z.string().optional(),
  essential: z.boolean(),
  description: z.string(),
});
export type CoursePrerequisiteView = z.infer<typeof CoursePrerequisiteViewSchema>;

export const CourseVersionViewSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().positive(),
  syllabus_text: z.string(),
  duration_hours: z.number().int().positive().nullable().optional(),
});
export type CourseVersionView = z.infer<typeof CourseVersionViewSchema>;

export const CourseListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  active_editions_count: z.number().int().nonnegative(),
  next_start_date: z.string().nullable().optional(),
  is_demo: z.boolean(),
});
export type CourseListItem = z.infer<typeof CourseListItemSchema>;

export const CourseListResponseSchema = z.object({
  items: z.array(CourseListItemSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
});
export type CourseListResponse = z.infer<typeof CourseListResponseSchema>;

export const CourseDetailViewSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  organization: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  version: CourseVersionViewSchema,
  learning_outcomes: z.array(CourseLearningOutcomeViewSchema),
  prerequisites: z.array(CoursePrerequisiteViewSchema),
  editions: z.array(CourseEditionViewSchema),
  is_demo: z.boolean(),
});
export type CourseDetailView = z.infer<typeof CourseDetailViewSchema>;

// Schemas de Plan Formativo
export const LearningPlanStepViewSchema = z.object({
  id: z.string().uuid().optional(),
  step_order: z.number().int().positive(),
  edition_id: z.string().uuid(),
  course_title: z.string(),
  step_type: PlanStepTypeSchema,
  conditional_prerequisite_description: z.string().nullable().optional(),
  schedule_summary: z.string(),
  cost_amount: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
});
export type LearningPlanStepView = z.infer<typeof LearningPlanStepViewSchema>;

export const LearningPlanViewSchema = z.object({
  id: z.string().uuid(),
  target_opportunity_id: z.string().uuid().nullable().optional(),
  target_occupation_id: z.string().uuid().nullable().optional(),
  status: LearningPlanStatusSchema,
  feasibility: PlanFeasibilitySchema,
  coverage_numerator: z.number().int().nonnegative(),
  coverage_denominator: z.number().int().nonnegative(),
  total_cost_amount: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  residual_gap: z.array(z.string()),
  reasons: z.array(z.string()),
  steps: z.array(LearningPlanStepViewSchema),
  outdated: z.boolean(),
  version: z.number().int().positive(),
  confirmed_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type LearningPlanView = z.infer<typeof LearningPlanViewSchema>;

export const LearningPlanPreviewRequestSchema = z.object({
  target_opportunity_id: z.string().uuid().optional(),
  target_occupation_id: z.string().uuid().optional(),
  assumptions: z.object({
    commute_minutes: z.number().int().nonnegative().optional(),
    max_budget_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    horizon_days: z.number().int().positive().optional(),
  }).optional(),
}).strict();
export type LearningPlanPreviewRequest = z.infer<typeof LearningPlanPreviewRequestSchema>;

export const LearningPlanConfirmRequestSchema = z.object({
  plan_id: z.string().uuid(),
}).strict();
export type LearningPlanConfirmRequest = z.infer<typeof LearningPlanConfirmRequestSchema>;

export const LearningPlanExplanationViewSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  agent_id: z.literal("A05"),
  contract_version: z.literal("agent-result/1"),
  status: z.enum(["completed", "needs_input", "blocked", "error"]),
  summary: z.string(),
  decision: z.object({
    code: z.string(),
    feasibility: PlanFeasibilitySchema,
    reasons: z.array(z.string()),
  }),
  missing_fields: z.array(z.string()),
  questions: z.array(z.object({ field: z.string(), text: z.string() })),
  created_at: z.string(),
});
export type LearningPlanExplanationView = z.infer<typeof LearningPlanExplanationViewSchema>;

// Schemas de Reservas y Agenda
export const CourseReservationRequestSchema = z.object({
  edition_id: z.string().uuid(),
  plan_id: z.string().uuid().optional(),
}).strict();
export type CourseReservationRequest = z.infer<typeof CourseReservationRequestSchema>;

export const CourseReservationViewSchema = z.object({
  id: z.string().uuid(),
  reservation_number: z.string(),
  edition_id: z.string().uuid(),
  course_title: z.string(),
  status: ReservationStatusSchema,
  schedule_summary: z.string(),
  remaining_slots: z.number().int().nonnegative(),
  receipt_id: z.string().uuid().optional(),
  created_at: z.string(),
  cancelled_at: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
});
export type CourseReservationView = z.infer<typeof CourseReservationViewSchema>;

export const CourseReservationCancellationRequestSchema = z.object({
  reason: z.string().min(5).max(500),
}).strict();
export type CourseReservationCancellationRequest = z.infer<typeof CourseReservationCancellationRequestSchema>;

export const AgendaEventViewSchema = z.object({
  id: z.string().uuid(),
  reservation_id: z.string().uuid(),
  course_title: z.string(),
  weekday: z.number().int().min(1).max(7),
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  start_time: z.string(),
  end_time: z.string(),
  location: z.string().nullable().optional(),
  timezone: z.string(),
  status: ReservationStatusSchema,
});
export type AgendaEventView = z.infer<typeof AgendaEventViewSchema>;

export const AgendaViewSchema = z.object({
  events: z.array(AgendaEventViewSchema),
});
export type AgendaView = z.infer<typeof AgendaViewSchema>;

// Tool Schemas para A05
export const A05LeerMetaPerfilArgsSchema = z.object({
  profile_id: z.string().uuid(),
}).strict();
export type A05LeerMetaPerfilArgs = z.infer<typeof A05LeerMetaPerfilArgsSchema>;

export const A05BuscarEdicionesArgsSchema = z.object({
  competency_ids: z.array(z.string().uuid()).optional(),
  modality: WorkplaceTypeSchema.optional(),
  max_cost: z.number().nonnegative().optional(),
}).strict();
export type A05BuscarEdicionesArgs = z.infer<typeof A05BuscarEdicionesArgsSchema>;

export const A05CalcularRutasArgsSchema = z.object({
  assumptions: z.object({
    commute_minutes: z.number().int().nonnegative().optional(),
    max_budget: z.number().nonnegative().optional(),
  }).optional(),
}).strict();
export type A05CalcularRutasArgs = z.infer<typeof A05CalcularRutasArgsSchema>;

export const A05LeerResultadoArgsSchema = z.object({
  plan_id: z.string().uuid(),
}).strict();
export type A05LeerResultadoArgs = z.infer<typeof A05LeerResultadoArgsSchema>;

export const A05EntregarExplicacionArgsSchema = z.object({
  summary: z.string().max(1000),
  decision: z.object({
    code: z.string(),
    feasibility: PlanFeasibilitySchema,
  }),
  missing_fields: z.array(z.string()).optional(),
  questions: z.array(z.object({ field: z.string(), text: z.string() })).max(3).optional(),
}).strict();
export type A05EntregarExplicacionArgs = z.infer<typeof A05EntregarExplicacionArgsSchema>;

// ==========================================
// D5/D6: Recutamiento, Vacantes y Candidaturas
// ==========================================

export const OpportunityDraftStatusSchema = z.enum(["DRAFT", "READY_TO_PUBLISH", "PUBLISHED"]);
export type OpportunityDraftStatus = z.infer<typeof OpportunityDraftStatusSchema>;

export const CandidateApplicationStatusSchema = z.enum(["ACTIVE", "WITHDRAWN"]);
export type CandidateApplicationStatus = z.infer<typeof CandidateApplicationStatusSchema>;

export const DiscriminatoryWarningSchema = z.object({
  field: z.string(),
  issue: z.string(),
  severity: z.literal("BLOCKING"),
  explanation: z.string(),
});
export type DiscriminatoryWarning = z.infer<typeof DiscriminatoryWarningSchema>;

export const OpportunityDraftRequirementSchema = z.object({
  competency_id: z.string().uuid(),
  competency_name: z.string(),
  requirement_type: RequirementTypeSchema,
  stage: RequirementStageSchema,
  description: z.string(),
});
export type OpportunityDraftRequirement = z.infer<typeof OpportunityDraftRequirementSchema>;

export const OpportunityDraftViewSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  author_user_id: z.string().uuid(),
  raw_text: z.string(),
  title: z.string().nullable().optional(),
  occupation_id: z.string().uuid().nullable().optional(),
  occupation_name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  workplace_type: WorkplaceTypeSchema,
  salary_amount: z.number().nullable().optional(),
  salary_currency: z.string().nullable().optional(),
  salary_period: MoneyPeriodSchema.nullable().optional(),
  schedule_summary: z.string().nullable().optional(),
  available_slots: z.number().int().min(1),
  proposed_requirements: z.array(OpportunityDraftRequirementSchema),
  clarification_questions: z.array(z.string()),
  clarification_answers: z.array(z.object({ question: z.string(), answer: z.string() })),
  discriminatory_warnings: z.array(DiscriminatoryWarningSchema),
  has_blocking_issues: z.boolean(),
  status: OpportunityDraftStatusSchema,
  published_opportunity_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OpportunityDraftView = z.infer<typeof OpportunityDraftViewSchema>;

export const CreateOpportunityDraftRequestSchema = z.object({
  raw_text: z.string().min(10).max(5000),
  title: z.string().max(160).optional(),
  location: z.string().max(200).optional(),
  workplace_type: WorkplaceTypeSchema.optional(),
  salary_amount: z.number().nonnegative().optional(),
  salary_currency: z.string().max(3).optional(),
  salary_period: MoneyPeriodSchema.optional(),
  schedule_summary: z.string().max(200).optional(),
  available_slots: z.number().int().min(1).optional(),
}).strict();
export type CreateOpportunityDraftRequest = z.infer<typeof CreateOpportunityDraftRequestSchema>;

export const UpdateOpportunityDraftRequestSchema = z.object({
  title: z.string().max(160).optional(),
  occupation_id: z.string().uuid().optional(),
  location: z.string().max(200).optional(),
  workplace_type: WorkplaceTypeSchema.optional(),
  salary_amount: z.number().nonnegative().nullable().optional(),
  salary_currency: z.string().max(3).nullable().optional(),
  salary_period: MoneyPeriodSchema.nullable().optional(),
  schedule_summary: z.string().max(200).nullable().optional(),
  available_slots: z.number().int().min(1).optional(),
  proposed_requirements: z.array(OpportunityDraftRequirementSchema).optional(),
  clarification_answers: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
}).strict();
export type UpdateOpportunityDraftRequest = z.infer<typeof UpdateOpportunityDraftRequestSchema>;

export const PublishOpportunityDraftRequestSchema = z.object({
  title: z.string().min(3).max(160),
  occupation_id: z.string().uuid(),
  location: z.string().min(2).max(200),
  workplace_type: WorkplaceTypeSchema,
  requirements: z.array(z.object({
    competency_id: z.string().uuid(),
    requirement_type: RequirementTypeSchema,
    stage: RequirementStageSchema,
    description: z.string(),
  })).min(1),
  salary_amount: z.number().nonnegative().optional(),
  salary_currency: z.string().max(3).optional(),
  salary_period: MoneyPeriodSchema.optional(),
  schedule_summary: z.string().max(200).optional(),
  available_slots: z.number().int().min(1).optional(),
}).strict();
export type PublishOpportunityDraftRequest = z.infer<typeof PublishOpportunityDraftRequestSchema>;

export const CandidateApplicationViewSchema = z.object({
  id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  opportunity_title: z.string(),
  company_name: z.string(),
  profile_revision_id: z.string().uuid(),
  status: CandidateApplicationStatusSchema,
  receipt_number: z.string(),
  consent_given_at: z.string(),
  withdrawn_at: z.string().nullable().optional(),
  withdrawal_reason: z.string().nullable().optional(),
  created_at: z.string(),
});
export type CandidateApplicationView = z.infer<typeof CandidateApplicationViewSchema>;

export const ApplyToOpportunityRequestSchema = z.object({
  profile_revision_id: z.string().uuid(),
  consent_confirmed: z.literal(true),
  idempotency_key: z.string().optional(),
}).strict();
export type ApplyToOpportunityRequest = z.infer<typeof ApplyToOpportunityRequestSchema>;

export const WithdrawApplicationRequestSchema = z.object({
  reason: z.string().max(500).optional(),
  idempotency_key: z.string().optional(),
}).strict();
export type WithdrawApplicationRequest = z.infer<typeof WithdrawApplicationRequestSchema>;

// Consulta empresarial minimizada (SIN datos personales prohibidos: sin nombre, foto, contacto ni género)
export const EmployerCandidateSkillViewSchema = z.object({
  competency_id: z.string().uuid(),
  competency_name: z.string(),
  status: z.enum(["DECLARADO", "DOCUMENTADO", "DEMOSTRADO", "DESCONOCIDO"]),
  evidence_summary: z.string().nullable().optional(),
});
export type EmployerCandidateSkillView = z.infer<typeof EmployerCandidateSkillViewSchema>;

export const EmployerCandidateGapViewSchema = z.object({
  competency_id: z.string().uuid(),
  competency_name: z.string(),
  requirement_type: RequirementTypeSchema,
  stage: RequirementStageSchema,
  status: z.enum(["CUMPLE", "NO_CUMPLE", "DESCONOCIDO"]),
});
export type EmployerCandidateGapView = z.infer<typeof EmployerCandidateGapViewSchema>;

export const EmployerApplicationItemViewSchema = z.object({
  id: z.string().uuid(),
  candidate_anonymized_id: z.string(),
  opportunity_id: z.string().uuid(),
  status: CandidateApplicationStatusSchema,
  consent_given_at: z.string(),
  withdrawn_at: z.string().nullable().optional(),
  coverage_percentage: z.number().nullable().optional(),
  feasibility: ComparisonFeasibilitySchema,
  skills: z.array(EmployerCandidateSkillViewSchema),
  gaps: z.array(EmployerCandidateGapViewSchema),
});
export type EmployerApplicationItemView = z.infer<typeof EmployerApplicationItemViewSchema>;

// Tool Schemas para A01
export const A01BuscarCatalogoOcupacionesArgsSchema = z.object({
  query: z.string(),
}).strict();
export type A01BuscarCatalogoOcupacionesArgs = z.infer<typeof A01BuscarCatalogoOcupacionesArgsSchema>;

export const A01BuscarCatalogoCompetenciasArgsSchema = z.object({
  query: z.string(),
  occupation_id: z.string().uuid().optional(),
}).strict();
export type A01BuscarCatalogoCompetenciasArgs = z.infer<typeof A01BuscarCatalogoCompetenciasArgsSchema>;

export const A01ProponerVacanteArgsSchema = z.object({
  title: z.string(),
  occupation_id: z.string().uuid(),
  requirements: z.array(z.object({
    competency_id: z.string().uuid(),
    requirement_type: RequirementTypeSchema,
    stage: RequirementStageSchema,
    description: z.string(),
  })),
  questions: z.array(z.string()).max(3).optional(),
  discriminatory_warnings: z.array(DiscriminatoryWarningSchema).optional(),
}).strict();
export type A01ProponerVacanteArgs = z.infer<typeof A01ProponerVacanteArgsSchema>;



// ==========================================
// D8: ORIENTADOR INDEPENDIENTE Y ACOMPAÑAMIENTO
// ==========================================

export const CounselorSummaryViewSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  headline: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  specialties: z.array(z.string()),
});
export type CounselorSummaryView = z.infer<typeof CounselorSummaryViewSchema>;

export const OrientationRequestStatusSchema = z.enum([
  "REQUESTED",
  "IN_REVIEW",
  "CLARIFICATION_REQUESTED",
  "APPROVED",
  "REJECTED",
  "OUTDATED",
  "REVOKED",
]);
export type OrientationRequestStatus = z.infer<typeof OrientationRequestStatusSchema>;

export const OrientationReviewDecisionSchema = z.enum([
  "APPROVED",
  "REJECTED",
  "CLARIFICATION_NEEDED",
]);
export type OrientationReviewDecision = z.infer<typeof OrientationReviewDecisionSchema>;

export const ClarificationDecisionSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);
export type ClarificationDecision = z.infer<typeof ClarificationDecisionSchema>;

export const CreateOrientationEngagementRequestSchema = z.object({
  counselor_id: z.string().uuid(),
  purpose: z.string().max(500).optional(),
});
export type CreateOrientationEngagementRequest = z.infer<typeof CreateOrientationEngagementRequestSchema>;

export const RevokeOrientationEngagementRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RevokeOrientationEngagementRequest = z.infer<typeof RevokeOrientationEngagementRequestSchema>;

export const CreateClarificationRequestSchema = z.object({
  question: z.string().min(5).max(1000),
  proposed_correction: z.string().max(1000).optional(),
});
export type CreateClarificationRequest = z.infer<typeof CreateClarificationRequestSchema>;

export const RespondClarificationRequestSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  response: z.string().max(1000).optional(),
});
export type RespondClarificationRequest = z.infer<typeof RespondClarificationRequestSchema>;

export const CreateOrientationReviewRequestSchema = z.object({
  expected_plan_version: z.number().int().positive(),
  decision: z.enum(["APPROVED", "REJECTED", "CLARIFICATION_NEEDED"]),
  motivation: z.string().min(5).max(2000),
  reasons: z.array(z.string()).optional(),
});
export type CreateOrientationReviewRequest = z.infer<typeof CreateOrientationReviewRequestSchema>;

export const ClarificationItemViewSchema = z.object({
  id: z.string().uuid(),
  engagement_id: z.string().uuid(),
  question: z.string(),
  proposed_correction: z.string().nullable().optional(),
  youth_decision: ClarificationDecisionSchema,
  youth_response: z.string().nullable().optional(),
  created_at: z.string(),
  responded_at: z.string().nullable().optional(),
});
export type ClarificationItemView = z.infer<typeof ClarificationItemViewSchema>;

export const OrientationReviewViewSchema = z.object({
  id: z.string().uuid(),
  engagement_id: z.string().uuid(),
  counselor_user_id: z.string().uuid(),
  counselor_name: z.string(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int(),
  revision_id: z.string().uuid(),
  decision: OrientationReviewDecisionSchema,
  motivation: z.string(),
  reasons: z.array(z.string()),
  reviewed_at: z.string(),
});
export type OrientationReviewView = z.infer<typeof OrientationReviewViewSchema>;

export const OrientationEngagementViewSchema = z.object({
  id: z.string().uuid(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int(),
  candidate_profile_id: z.string().uuid(),
  counselor: CounselorSummaryViewSchema,
  purpose: z.string().nullable().optional(),
  status: OrientationRequestStatusSchema,
  status_reason: z.string().nullable().optional(),
  requested_at: z.string(),
  responded_at: z.string().nullable().optional(),
  revoked_at: z.string().nullable().optional(),
  revocation_reason: z.string().nullable().optional(),
  receipt_number: z.string(),
  reviews: z.array(OrientationReviewViewSchema).optional(),
  clarifications: z.array(ClarificationItemViewSchema).optional(),
});
export type OrientationEngagementView = z.infer<typeof OrientationEngagementViewSchema>;

export const CounselorInboxItemViewSchema = z.object({
  id: z.string().uuid(),
  candidate_name: z.string(),
  target_opportunity_title: z.string().nullable().optional(),
  plan_id: z.string().uuid(),
  plan_version: z.number().int(),
  status: OrientationRequestStatusSchema,
  requested_at: z.string(),
  clarifications_count: z.number().int(),
});
export type CounselorInboxItemView = z.infer<typeof CounselorInboxItemViewSchema>;

export const CounselorEngagementDetailViewSchema = z.object({
  engagement: OrientationEngagementViewSchema,
  candidate_summary: z.object({
    display_name: z.string(),
    headline: z.string().nullable().optional(),
    max_commute_minutes: z.number().nullable().optional(),
    training_budget: z.string().nullable().optional(),
  }),
  target_opportunity: z.object({
    id: z.string().uuid(),
    title: z.string(),
    organization_name: z.string(),
    workplace_type: WorkplaceTypeSchema,
    location: z.string(),
  }).nullable().optional(),
  plan: LearningPlanViewSchema,
  explanations: z.array(z.object({
    summary: z.string(),
    reasons: z.array(z.string()),
    created_at: z.string(),
  })).optional(),
  reviews: z.array(OrientationReviewViewSchema),
  clarifications: z.array(ClarificationItemViewSchema),
});
export type CounselorEngagementDetailView = z.infer<typeof CounselorEngagementDetailViewSchema>;

export * from './training-center';
export * from './training-participants';
export * from './training-assessments';
export * from './training-certificates';
