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

