-- Generated with the schema engine dependency of Prisma 7.10.1.
-- Explicit search_path scopes all unqualified objects to app.
-- Not applied to Supabase.
BEGIN;
-- CreateSchema
CREATE SCHEMA "app";
SET LOCAL search_path = "app", "pg_catalog";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('UNKNOWN', 'NONE', 'PROVIDED');

-- CreateEnum
CREATE TYPE "KnowledgeState" AS ENUM ('UNKNOWN', 'KNOWN');

-- CreateEnum
CREATE TYPE "ExperienceKind" AS ENUM ('FORMAL', 'INFORMAL', 'VOLUNTEER', 'PERSONAL_PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "CompetencyKind" AS ENUM ('KNOWLEDGE', 'SKILL');

-- CreateEnum
CREATE TYPE "ClaimDecision" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('MANUAL_TEXT', 'PDF', 'IMAGE', 'AUDIO');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'READY', 'FAILED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('SELF_REPORT', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MobilityMode" AS ENUM ('BUS', 'METRO', 'WALKING', 'BICYCLE', 'PRIVATE_VEHICLE', 'OTHER');

-- CreateEnum
CREATE TYPE "MoneyPeriod" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH', 'TOTAL');

-- CreateEnum
CREATE TYPE "ProfileSection" AS ENUM ('ACCOUNT', 'EXPERIENCE', 'TRAINING', 'INTERESTS', 'COMPETENCIES', 'AVAILABILITY', 'CONSTRAINTS', 'FINAL_REVIEW');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('REVIEWED', 'DEFERRED');

-- CreateTable
CREATE TABLE "AppUser" (
    "id" UUID NOT NULL,
    "authSubject" UUID NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'es',
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "currentVersionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileRevision" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "baseVersionId" UUID,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "versionNumber" INTEGER,
    "displayName" VARCHAR(100),
    "headline" VARCHAR(160),
    "experienceStatus" "DeclarationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "trainingStatus" "DeclarationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "interestsStatus" "DeclarationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "snapshotDigest" VARCHAR(64),
    "confirmedAt" TIMESTAMPTZ(3),
    "confirmedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProfileRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileExperience" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "kind" "ExperienceKind" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "organizationName" VARCHAR(160),
    "description" VARCHAR(3000) NOT NULL,
    "startMonth" VARCHAR(7),
    "endMonth" VARCHAR(7),
    "ongoing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProfileExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDeclaration" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "providerName" VARCHAR(160),
    "completedOn" DATE,

    CONSTRAINT "TrainingDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogVersion" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sourceLabel" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupationEntry" (
    "id" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OccupationEntry_pkey" PRIMARY KEY ("id","catalogVersionId")
);

-- CreateTable
CREATE TABLE "OccupationAlias" (
    "id" UUID NOT NULL,
    "occupationId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "text" VARCHAR(160) NOT NULL,
    "context" VARCHAR(200) NOT NULL DEFAULT '',

    CONSTRAINT "OccupationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyEntry" (
    "id" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "kind" "CompetencyKind" NOT NULL,

    CONSTRAINT "CompetencyEntry_pkey" PRIMARY KEY ("id","catalogVersionId")
);

-- CreateTable
CREATE TABLE "CompetencyAlias" (
    "id" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "text" VARCHAR(160) NOT NULL,
    "context" VARCHAR(200) NOT NULL DEFAULT '',

    CONSTRAINT "CompetencyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobInterest" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "originalText" VARCHAR(160) NOT NULL,
    "occupationId" UUID,
    "catalogVersionId" UUID,

    CONSTRAINT "JobInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyClaim" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "originalText" VARCHAR(300) NOT NULL,
    "criterion" VARCHAR(1000) NOT NULL,
    "decision" "ClaimDecision" NOT NULL DEFAULT 'PROPOSED',

    CONSTRAINT "CompetencyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileConstraints" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "locationState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "approximateZone" VARCHAR(160),
    "availabilityState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "mobilityState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "mobilityModes" "MobilityMode"[] DEFAULT ARRAY[]::"MobilityMode"[],
    "travelLimitState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "maxOneWayMinutes" INTEGER,
    "salaryState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "minimumSalary" DECIMAL(14,2),
    "salaryCurrency" VARCHAR(3),
    "salaryPeriod" "MoneyPeriod",
    "transportState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "transportBudget" DECIMAL(14,2),
    "transportCurrency" VARCHAR(3),
    "transportPeriod" "MoneyPeriod",
    "trainingState" "KnowledgeState" NOT NULL DEFAULT 'UNKNOWN',
    "trainingBudget" DECIMAL(14,2),
    "trainingCurrency" VARCHAR(3),
    "trainingPeriod" "MoneyPeriod",

    CONSTRAINT "ProfileConstraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Panama',
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExceptionInterval" (
    "id" UUID NOT NULL,
    "exceptionId" UUID NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "ExceptionInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileSource" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "kind" "SourceKind" NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'RECEIVED',
    "sha256" VARCHAR(64) NOT NULL,
    "mediaType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "manualText" VARCHAR(20000),
    "storageKey" VARCHAR(512),
    "correctionOfId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFragment" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "text" VARCHAR(20000) NOT NULL,
    "page" INTEGER,
    "startMillis" INTEGER,
    "endMillis" INTEGER,

    CONSTRAINT "SourceFragment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEvidence" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "fragmentId" UUID NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "scope" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileEvidenceLink" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "experienceId" UUID,
    "trainingId" UUID,
    "claimId" UUID,

    CONSTRAINT "ProfileEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionReview" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "section" "ProfileSection" NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "contentRevision" INTEGER NOT NULL,
    "actorUserId" UUID NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilePreview" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "draftRevision" INTEGER NOT NULL,
    "snapshotDigest" VARCHAR(64) NOT NULL,
    "acknowledgePartialRequired" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProfilePreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileConfirmation" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "previewId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "acknowledgedPartial" BOOLEAN NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationReceipt" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "profileId" UUID,
    "operation" VARCHAR(60) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "receiptPayload" JSONB NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "profileId" UUID,
    "revisionId" UUID,
    "operationId" UUID,
    "caseId" VARCHAR(100) NOT NULL,
    "event" VARCHAR(80) NOT NULL,
    "reasonCode" VARCHAR(80) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_authSubject_key" ON "AppUser"("authSubject");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_ownerUserId_key" ON "CandidateProfile"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_currentVersionId_key" ON "CandidateProfile"("currentVersionId");

-- CreateIndex
CREATE INDEX "ProfileRevision_profileId_status_idx" ON "ProfileRevision"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileRevision_profileId_id_key" ON "ProfileRevision"("profileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileRevision_profileId_versionNumber_key" ON "ProfileRevision"("profileId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileExperience_profileId_revisionId_id_key" ON "ProfileExperience"("profileId", "revisionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDeclaration_profileId_revisionId_id_key" ON "TrainingDeclaration"("profileId", "revisionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVersion_code_key" ON "CatalogVersion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OccupationEntry_catalogVersionId_code_key" ON "OccupationEntry"("catalogVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OccupationAlias_occupationId_catalogVersionId_text_context_key" ON "OccupationAlias"("occupationId", "catalogVersionId", "text", "context");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyEntry_catalogVersionId_code_key" ON "CompetencyEntry"("catalogVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAlias_competencyId_catalogVersionId_text_context_key" ON "CompetencyAlias"("competencyId", "catalogVersionId", "text", "context");

-- CreateIndex
CREATE INDEX "JobInterest_profileId_revisionId_idx" ON "JobInterest"("profileId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyClaim_profileId_revisionId_id_key" ON "CompetencyClaim"("profileId", "revisionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyClaim_revisionId_competencyId_catalogVersionId_key" ON "CompetencyClaim"("revisionId", "competencyId", "catalogVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileConstraints_revisionId_key" ON "ProfileConstraints"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileConstraints_profileId_revisionId_key" ON "ProfileConstraints"("profileId", "revisionId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_profileId_revisionId_idx" ON "AvailabilityWindow"("profileId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityException_revisionId_date_key" ON "AvailabilityException"("revisionId", "date");

-- CreateIndex
CREATE INDEX "ExceptionInterval_exceptionId_idx" ON "ExceptionInterval"("exceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSource_storageKey_key" ON "ProfileSource"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileSource_profileId_id_key" ON "ProfileSource"("profileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SourceFragment_profileId_id_key" ON "SourceFragment"("profileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileEvidence_profileId_id_key" ON "ProfileEvidence"("profileId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileEvidenceLink_evidenceId_experienceId_key" ON "ProfileEvidenceLink"("evidenceId", "experienceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileEvidenceLink_evidenceId_trainingId_key" ON "ProfileEvidenceLink"("evidenceId", "trainingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileEvidenceLink_evidenceId_claimId_key" ON "ProfileEvidenceLink"("evidenceId", "claimId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionReview_revisionId_section_key" ON "SectionReview"("revisionId", "section");

-- CreateIndex
CREATE INDEX "ProfilePreview_revisionId_idx" ON "ProfilePreview"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileConfirmation_revisionId_key" ON "ProfileConfirmation"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileConfirmation_previewId_key" ON "ProfileConfirmation"("previewId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileConfirmation_operationId_key" ON "ProfileConfirmation"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationReceipt_actorUserId_operation_idempotencyKey_key" ON "OperationReceipt"("actorUserId", "operation", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditEvent_profileId_recordedAt_id_idx" ON "AuditEvent"("profileId", "recordedAt", "id");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRevision" ADD CONSTRAINT "ProfileRevision_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRevision" ADD CONSTRAINT "ProfileRevision_profileId_baseVersionId_fkey" FOREIGN KEY ("profileId", "baseVersionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRevision" ADD CONSTRAINT "ProfileRevision_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileExperience" ADD CONSTRAINT "ProfileExperience_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDeclaration" ADD CONSTRAINT "TrainingDeclaration_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupationEntry" ADD CONSTRAINT "OccupationEntry_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupationAlias" ADD CONSTRAINT "OccupationAlias_occupationId_catalogVersionId_fkey" FOREIGN KEY ("occupationId", "catalogVersionId") REFERENCES "OccupationEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyEntry" ADD CONSTRAINT "CompetencyEntry_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAlias" ADD CONSTRAINT "CompetencyAlias_competencyId_catalogVersionId_fkey" FOREIGN KEY ("competencyId", "catalogVersionId") REFERENCES "CompetencyEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInterest" ADD CONSTRAINT "JobInterest_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInterest" ADD CONSTRAINT "JobInterest_occupationId_catalogVersionId_fkey" FOREIGN KEY ("occupationId", "catalogVersionId") REFERENCES "OccupationEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyClaim" ADD CONSTRAINT "CompetencyClaim_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyClaim" ADD CONSTRAINT "CompetencyClaim_competencyId_catalogVersionId_fkey" FOREIGN KEY ("competencyId", "catalogVersionId") REFERENCES "CompetencyEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileConstraints" ADD CONSTRAINT "ProfileConstraints_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExceptionInterval" ADD CONSTRAINT "ExceptionInterval_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "AvailabilityException"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSource" ADD CONSTRAINT "ProfileSource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileSource" ADD CONSTRAINT "ProfileSource_profileId_correctionOfId_fkey" FOREIGN KEY ("profileId", "correctionOfId") REFERENCES "ProfileSource"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFragment" ADD CONSTRAINT "SourceFragment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFragment" ADD CONSTRAINT "SourceFragment_profileId_sourceId_fkey" FOREIGN KEY ("profileId", "sourceId") REFERENCES "ProfileSource"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidence" ADD CONSTRAINT "ProfileEvidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidence" ADD CONSTRAINT "ProfileEvidence_profileId_fragmentId_fkey" FOREIGN KEY ("profileId", "fragmentId") REFERENCES "SourceFragment"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidenceLink" ADD CONSTRAINT "ProfileEvidenceLink_profileId_revisionId_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES "ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidenceLink" ADD CONSTRAINT "ProfileEvidenceLink_profileId_evidenceId_fkey" FOREIGN KEY ("profileId", "evidenceId") REFERENCES "ProfileEvidence"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidenceLink" ADD CONSTRAINT "ProfileEvidenceLink_profileId_revisionId_experienceId_fkey" FOREIGN KEY ("profileId", "revisionId", "experienceId") REFERENCES "ProfileExperience"("profileId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidenceLink" ADD CONSTRAINT "ProfileEvidenceLink_profileId_revisionId_trainingId_fkey" FOREIGN KEY ("profileId", "revisionId", "trainingId") REFERENCES "TrainingDeclaration"("profileId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileEvidenceLink" ADD CONSTRAINT "ProfileEvidenceLink_profileId_revisionId_claimId_fkey" FOREIGN KEY ("profileId", "revisionId", "claimId") REFERENCES "CompetencyClaim"("profileId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionReview" ADD CONSTRAINT "SectionReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionReview" ADD CONSTRAINT "SectionReview_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePreview" ADD CONSTRAINT "ProfilePreview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileConfirmation" ADD CONSTRAINT "ProfileConfirmation_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileConfirmation" ADD CONSTRAINT "ProfileConfirmation_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "ProfilePreview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileConfirmation" ADD CONSTRAINT "ProfileConfirmation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "OperationReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileConfirmation" ADD CONSTRAINT "ProfileConfirmation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationReceipt" ADD CONSTRAINT "OperationReceipt_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationReceipt" ADD CONSTRAINT "OperationReceipt_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "OperationReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CUSTOM GUARDS: source prisma/guards.sql
-- Canonical PostgreSQL guards, appended to the generated initial migration.
-- Not executed against Supabase by schema preparation commands.
CREATE UNIQUE INDEX "one_active_draft_per_profile"
  ON app."ProfileRevision" ("profileId") WHERE status = 'DRAFT';

ALTER TABLE app."ProfileRevision" ADD CONSTRAINT "revision_state_valid" CHECK (
  revision >= 1 AND
  ((status = 'CONFIRMED' AND "versionNumber" IS NOT NULL AND "versionNumber" > 0 AND "displayName" IS NOT NULL
    AND length(btrim("displayName")) > 0 AND "confirmedAt" IS NOT NULL
    AND "confirmedById" IS NOT NULL AND "snapshotDigest" IS NOT NULL AND "snapshotDigest" ~ '^[a-f0-9]{64}$')
   OR (status <> 'CONFIRMED' AND "versionNumber" IS NULL AND "confirmedAt" IS NULL
    AND "confirmedById" IS NULL AND "snapshotDigest" IS NULL))
);
ALTER TABLE app."ProfileExperience" ADD CONSTRAINT "experience_fields_valid" CHECK (
  length(btrim(title)) > 0 AND length(btrim(description)) > 0
  AND ("startMonth" IS NULL OR "startMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  AND ("endMonth" IS NULL OR "endMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
  AND ("startMonth" IS NULL OR "endMonth" IS NULL OR "endMonth" >= "startMonth")
  AND (NOT ongoing OR "endMonth" IS NULL)
);
ALTER TABLE app."TrainingDeclaration" ADD CONSTRAINT "training_fields_valid" CHECK (
  length(btrim(name)) > 0 AND ("completedOn" IS NULL OR "completedOn" <= CURRENT_DATE)
);
ALTER TABLE app."JobInterest" ADD CONSTRAINT "interest_fields_valid" CHECK (
  length(btrim("originalText")) > 0 AND
  (("occupationId" IS NULL) = ("catalogVersionId" IS NULL))
);
ALTER TABLE app."CompetencyClaim" ADD CONSTRAINT "claim_fields_valid" CHECK (
  length(btrim("originalText")) > 0 AND length(btrim(criterion)) > 0
);
ALTER TABLE app."AvailabilityWindow" ADD CONSTRAINT "window_fields_valid" CHECK (
  weekday BETWEEN 1 AND 7 AND "startMinute" >= 0 AND "startMinute" < "endMinute"
  AND "endMinute" <= 1440 AND "validFrom" <= "validTo"
);
ALTER TABLE app."ExceptionInterval" ADD CONSTRAINT "interval_fields_valid" CHECK (
  "startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440
);
ALTER TABLE app."ProfileConstraints" ADD CONSTRAINT "known_constraints_valid" CHECK (
  (("locationState" = 'UNKNOWN' AND "approximateZone" IS NULL) OR
   ("locationState" = 'KNOWN' AND "approximateZone" IS NOT NULL AND length(btrim("approximateZone")) > 0))
  AND (("mobilityState" = 'UNKNOWN' AND cardinality("mobilityModes") = 0) OR
       ("mobilityState" = 'KNOWN' AND cardinality("mobilityModes") > 0))
  AND (("travelLimitState" = 'UNKNOWN' AND "maxOneWayMinutes" IS NULL) OR
       ("travelLimitState" = 'KNOWN' AND "maxOneWayMinutes" IS NOT NULL AND "maxOneWayMinutes" BETWEEN 0 AND 1440))
  AND (("salaryState" = 'UNKNOWN' AND "minimumSalary" IS NULL AND "salaryCurrency" IS NULL AND "salaryPeriod" IS NULL) OR
       ("salaryState" = 'KNOWN' AND "minimumSalary" IS NOT NULL AND "minimumSalary" BETWEEN 0 AND 999999999999.99
        AND "salaryCurrency" IS NOT NULL AND "salaryCurrency" ~ '^[A-Z]{3}$'
        AND "salaryPeriod" IS NOT NULL AND "salaryPeriod" IN ('HOUR','DAY','WEEK','MONTH')))
  AND (("transportState" = 'UNKNOWN' AND "transportBudget" IS NULL AND "transportCurrency" IS NULL AND "transportPeriod" IS NULL) OR
       ("transportState" = 'KNOWN' AND "transportBudget" IS NOT NULL AND "transportBudget" BETWEEN 0 AND 999999999999.99
        AND "transportCurrency" IS NOT NULL AND "transportCurrency" ~ '^[A-Z]{3}$'
        AND "transportPeriod" IS NOT NULL AND "transportPeriod" IN ('DAY','WEEK','MONTH')))
  AND (("trainingState" = 'UNKNOWN' AND "trainingBudget" IS NULL AND "trainingCurrency" IS NULL AND "trainingPeriod" IS NULL) OR
       ("trainingState" = 'KNOWN' AND "trainingBudget" IS NOT NULL AND "trainingBudget" BETWEEN 0 AND 999999999999.99
        AND "trainingCurrency" IS NOT NULL AND "trainingCurrency" ~ '^[A-Z]{3}$'
        AND "trainingPeriod" IS NOT NULL AND "trainingPeriod" IN ('MONTH','TOTAL')))
);
-- PostgreSQL array nullability is not emitted by the Prisma list declaration.
-- NULL would make the cardinality CHECK unknown and bypass its empty/known rule.
ALTER TABLE app."ProfileConstraints" ALTER COLUMN "mobilityModes" SET NOT NULL;
ALTER TABLE app."ProfileSource" ADD CONSTRAINT "source_fields_valid" CHECK (
  version > 0 AND "sizeBytes" >= 0 AND sha256 ~ '^[a-f0-9]{64}$'
  AND ((kind = 'MANUAL_TEXT' AND "manualText" IS NOT NULL AND "storageKey" IS NULL)
       OR (kind <> 'MANUAL_TEXT' AND "manualText" IS NULL AND "storageKey" IS NOT NULL))
  AND ("correctionOfId" IS NULL OR "correctionOfId" <> id)
);
ALTER TABLE app."SourceFragment" ADD CONSTRAINT "fragment_fields_valid" CHECK (
  length(btrim(text)) > 0 AND (page IS NULL OR page > 0)
  AND (("startMillis" IS NULL AND "endMillis" IS NULL) OR
       ("startMillis" IS NOT NULL AND "endMillis" IS NOT NULL
        AND "startMillis" >= 0 AND "endMillis" > "startMillis"))
);
ALTER TABLE app."ProfileEvidence" ADD CONSTRAINT "evidence_scope_valid" CHECK (length(btrim(scope)) > 0);
ALTER TABLE app."ProfileEvidenceLink" ADD CONSTRAINT "exactly_one_evidence_target" CHECK (
  num_nonnulls("experienceId", "trainingId", "claimId") = 1
);
ALTER TABLE app."SectionReview" ADD CONSTRAINT "review_fields_valid" CHECK (
  "contentRevision" > 0 AND
  (section NOT IN ('ACCOUNT','FINAL_REVIEW') OR decision = 'REVIEWED')
);
ALTER TABLE app."ProfilePreview" ADD CONSTRAINT "preview_fields_valid" CHECK (
  "draftRevision" > 0 AND "snapshotDigest" ~ '^[a-f0-9]{64}$'
  AND "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '15 minutes'
);
ALTER TABLE app."OperationReceipt" ADD CONSTRAINT "receipt_fields_valid" CHECK (
  length("idempotencyKey") BETWEEN 16 AND 128 AND "payloadHash" ~ '^[a-f0-9]{64}$'
  AND length(btrim(operation)) > 0
);

CREATE FUNCTION app.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'append_only_record'; END;
$$;

-- Locks BOTH parents when a child is moved; locking only NEW permits removal
-- from a confirmed OLD revision. Lock order also bounds concurrent edits.
CREATE FUNCTION app.guard_revision_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_id uuid; new_id uuid; parent record;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := (to_jsonb(OLD)->>'revisionId')::uuid; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := (to_jsonb(NEW)->>'revisionId')::uuid; END IF;
  FOR parent IN SELECT id,status FROM app."ProfileRevision"
    WHERE id IN (old_id,new_id) ORDER BY id FOR UPDATE LOOP
    IF parent.status <> 'DRAFT' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='immutable_revision_child';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app.guard_exception_interval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_parent uuid; new_parent uuid; parent record;
BEGIN
  IF TG_OP <> 'INSERT' THEN SELECT "revisionId" INTO old_parent FROM app."AvailabilityException" WHERE id=OLD."exceptionId"; END IF;
  IF TG_OP <> 'DELETE' THEN SELECT "revisionId" INTO new_parent FROM app."AvailabilityException" WHERE id=NEW."exceptionId"; END IF;
  FOR parent IN SELECT id,status FROM app."ProfileRevision"
    WHERE id IN(old_parent,new_parent) ORDER BY id FOR UPDATE LOOP
    IF parent.status <> 'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='immutable_exception_interval'; END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM app."ExceptionInterval" x
     WHERE x."exceptionId"=NEW."exceptionId" AND x.id<>NEW.id
     AND x."startMinute"<NEW."endMinute" AND NEW."startMinute"<x."endMinute") THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='overlapping_exception_intervals';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app.guard_availability_window() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_timezone';
  END IF;
  IF EXISTS(SELECT 1 FROM app."AvailabilityWindow" w WHERE w."revisionId"=NEW."revisionId"
    AND w.id<>NEW.id AND w.weekday=NEW.weekday
    AND daterange(w."validFrom",w."validTo",'[]') && daterange(NEW."validFrom",NEW."validTo",'[]')
    AND w."startMinute"<NEW."endMinute" AND NEW."startMinute"<w."endMinute") THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='overlapping_availability';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app.guard_profile_pointer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target app."ProfileRevision";
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW."ownerUserId"<>OLD."ownerUserId") THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='immutable_profile_owner';
  END IF;
  IF NEW."currentVersionId" IS NOT NULL THEN
    SELECT * INTO target FROM app."ProfileRevision" WHERE id=NEW."currentVersionId";
    IF NOT FOUND OR target."profileId"<>NEW.id OR target.status<>'CONFIRMED' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_current_profile_version';
    END IF;
    IF TG_OP='UPDATE' AND OLD."currentVersionId" IS NOT NULL AND
      target."versionNumber" < (SELECT "versionNumber" FROM app."ProfileRevision" WHERE id=OLD."currentVersionId") THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='profile_version_cannot_go_back';
    END IF;
  ELSIF TG_OP='UPDATE' AND OLD."currentVersionId" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='confirmed_pointer_cannot_be_removed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app.guard_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; current_id uuid; preview app."ProfilePreview"; confirmation app."ProfileConfirmation"; next_version integer;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='revision_history_cannot_be_deleted'; END IF;
  SELECT "ownerUserId","currentVersionId" INTO owner_id,current_id FROM app."CandidateProfile" WHERE id=NEW."profileId" FOR UPDATE;
  IF NEW."baseVersionId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app."ProfileRevision"
    WHERE id=NEW."baseVersionId" AND "profileId"=NEW."profileId" AND status='CONFIRMED') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='base_version_must_be_confirmed';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'DRAFT' OR NEW.revision<>1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='new_revision_must_be_draft'; END IF;
    IF NEW."baseVersionId" IS DISTINCT FROM current_id THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='draft_base_must_be_current_version'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='immutable_profile_revision'; END IF;
  IF NEW.id<>OLD.id OR NEW."profileId"<>OLD."profileId" OR NEW."baseVersionId" IS DISTINCT FROM OLD."baseVersionId"
    OR NEW."createdAt"<>OLD."createdAt" OR NEW.revision<>OLD.revision+1 THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_revision_update';
  END IF;
  IF NEW.status='CONFIRMED' THEN
    IF (to_jsonb(NEW)-ARRAY['status','revision','versionNumber','snapshotDigest','confirmedAt','confirmedById','updatedAt'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision','versionNumber','snapshotDigest','confirmedAt','confirmedById','updatedAt']) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='confirmation_cannot_change_previewed_content';
    END IF;
    SELECT * INTO confirmation FROM app."ProfileConfirmation" WHERE "revisionId"=NEW.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='confirmation_receipt_required'; END IF;
    SELECT * INTO preview FROM app."ProfilePreview" WHERE id=confirmation."previewId";
    IF preview."revisionId"<>NEW.id OR preview."draftRevision"<>OLD.revision
      OR preview."expiresAt"<=clock_timestamp() OR preview."snapshotDigest"<>NEW."snapshotDigest"
      OR confirmation."actorUserId"<>owner_id OR NEW."confirmedById"<>owner_id
      OR NEW."confirmedAt"<>confirmation."confirmedAt"
      OR (preview."acknowledgePartialRequired" AND NOT confirmation."acknowledgedPartial") THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='stale_or_invalid_confirmation';
    END IF;
    SELECT COALESCE(max("versionNumber"),0)+1 INTO next_version FROM app."ProfileRevision" WHERE "profileId"=NEW."profileId";
    IF NEW."versionNumber"<>next_version THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_version_sequence'; END IF;
    IF (SELECT count(*) FROM app."SectionReview" WHERE "revisionId"=NEW.id AND "actorUserId"=owner_id)<>8
      OR NOT EXISTS(SELECT 1 FROM app."SectionReview" WHERE "revisionId"=NEW.id AND section='FINAL_REVIEW'
        AND decision='REVIEWED' AND "contentRevision"=OLD.revision) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='human_section_reviews_required';
    END IF;
    IF EXISTS(SELECT 1 FROM app."CompetencyClaim" c WHERE c."revisionId"=NEW.id AND
      (c.decision<>'ACCEPTED' OR NOT EXISTS(SELECT 1 FROM app."ProfileEvidenceLink" l WHERE l."claimId"=c.id))) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='only_accepted_evidenced_claims_can_be_confirmed';
    END IF;
    IF EXISTS(SELECT 1 FROM app."ProfileEvidenceLink" l
      JOIN app."ProfileEvidence" e ON e.id=l."evidenceId"
      JOIN app."SourceFragment" f ON f.id=e."fragmentId"
      JOIN app."ProfileSource" s ON s.id=f."sourceId"
      WHERE l."revisionId"=NEW.id AND s.status<>'READY') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='evidence_source_not_ready';
    END IF;
    IF (NEW."experienceStatus"='PROVIDED')<>(EXISTS(SELECT 1 FROM app."ProfileExperience" WHERE "revisionId"=NEW.id))
      OR (NEW."trainingStatus"='PROVIDED')<>(EXISTS(SELECT 1 FROM app."TrainingDeclaration" WHERE "revisionId"=NEW.id))
      OR (NEW."interestsStatus"='PROVIDED')<>(EXISTS(SELECT 1 FROM app."JobInterest" WHERE "revisionId"=NEW.id)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='section_declarations_disagree_with_collections';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM app."OperationReceipt" r WHERE r.id=confirmation."operationId"
      AND r."actorUserId"=owner_id AND r."profileId"=NEW."profileId" AND r.operation='CONFIRM_PROFILE')
      OR NOT EXISTS(SELECT 1 FROM app."AuditEvent" a WHERE a."operationId"=confirmation."operationId"
        AND a."revisionId"=NEW.id AND a."profileId"=NEW."profileId" AND a."actorUserId"=owner_id AND a.event='PROFILE_CONFIRMED') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='operation_and_audit_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- The receipt, revision transition and latest-version pointer must commit together.
CREATE FUNCTION app.check_confirmation_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v app."ProfileRevision";
BEGIN
  SELECT * INTO v FROM app."ProfileRevision" WHERE id=NEW."revisionId";
  IF v.status<>'CONFIRMED' OR NOT EXISTS(SELECT 1 FROM app."CandidateProfile" WHERE id=v."profileId" AND "currentVersionId"=v.id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='incomplete_confirmation_transaction';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION app.guard_source_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status')
     OR (OLD.status='WITHDRAWN' AND NEW.status<>'WITHDRAWN') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='immutable_source_content';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app.guard_user_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id<>OLD.id OR NEW."authSubject"<>OLD."authSubject" OR NEW."createdAt"<>OLD."createdAt" THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='immutable_auth_identity';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_identity BEFORE UPDATE ON app."AppUser" FOR EACH ROW EXECUTE FUNCTION app.guard_user_identity();
CREATE TRIGGER profile_pointer BEFORE INSERT OR UPDATE ON app."CandidateProfile" FOR EACH ROW EXECUTE FUNCTION app.guard_profile_pointer();
CREATE TRIGGER revision_guard BEFORE INSERT OR UPDATE OR DELETE ON app."ProfileRevision" FOR EACH ROW EXECUTE FUNCTION app.guard_revision();
CREATE CONSTRAINT TRIGGER confirmation_commit AFTER INSERT ON app."ProfileConfirmation"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_confirmation_commit();
CREATE TRIGGER source_content BEFORE UPDATE ON app."ProfileSource" FOR EACH ROW EXECUTE FUNCTION app.guard_source_update();
CREATE TRIGGER source_no_delete BEFORE DELETE ON app."ProfileSource" FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
CREATE TRIGGER interval_guard BEFORE INSERT OR UPDATE OR DELETE ON app."ExceptionInterval" FOR EACH ROW EXECUTE FUNCTION app.guard_exception_interval();
CREATE TRIGGER b_window_overlap BEFORE INSERT OR UPDATE ON app."AvailabilityWindow" FOR EACH ROW EXECUTE FUNCTION app.guard_availability_window();

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['ProfileExperience','TrainingDeclaration','JobInterest','CompetencyClaim',
    'ProfileConstraints','AvailabilityWindow','AvailabilityException','ProfileEvidenceLink','SectionReview','ProfilePreview'] LOOP
    EXECUTE format('CREATE TRIGGER a_revision_parent BEFORE INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.guard_revision_child()', tab);
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['SourceFragment','ProfileEvidence','CatalogVersion','OccupationEntry',
    'OccupationAlias','CompetencyEntry','CompetencyAlias','ProfilePreview','ProfileConfirmation','OperationReceipt','AuditEvent'] LOOP
    EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.reject_mutation()', tab);
  END LOOP;
END $$;

-- Closed by default. No auth.uid() assumption for Prisma's direct connection.
-- Runtime grants/policies need a separately reviewed deployment plan before API use.
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
DO $$ DECLARE tab record; role_name text; BEGIN
  FOR tab IN SELECT tablename FROM pg_tables WHERE schemaname='app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',tab.tablename);
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA app FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA app FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM %I',role_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
