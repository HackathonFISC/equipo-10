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
