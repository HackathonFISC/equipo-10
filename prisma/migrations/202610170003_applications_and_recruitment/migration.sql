BEGIN;

-- 1. Enums para D5/D6
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpportunityDraftStatus') THEN
        CREATE TYPE app."OpportunityDraftStatus" AS ENUM ('DRAFT', 'READY_TO_PUBLISH', 'PUBLISHED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CandidateApplicationStatus') THEN
        CREATE TYPE app."CandidateApplicationStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');
    END IF;
END;
$$;

-- 2. OpportunityDraft
CREATE TABLE IF NOT EXISTS app."OpportunityDraft" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "rawText" VARCHAR(5000) NOT NULL,
    "title" VARCHAR(160),
    "occupationId" UUID,
    "catalogVersionId" UUID,
    "location" VARCHAR(200),
    "workplaceType" app."WorkplaceType" NOT NULL DEFAULT 'ON_SITE',
    "salaryAmount" DECIMAL(14,2),
    "salaryCurrency" VARCHAR(3),
    "salaryPeriod" app."MoneyPeriod",
    "scheduleSummary" VARCHAR(200),
    "availableSlots" INTEGER NOT NULL DEFAULT 1,
    "proposedRequirements" JSONB,
    "clarificationQuestions" JSONB,
    "clarificationAnswers" JSONB,
    "discriminatoryWarnings" JSONB,
    "hasBlockingIssues" BOOLEAN NOT NULL DEFAULT false,
    "status" app."OpportunityDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedOpportunityId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpportunityDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES app."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpportunityDraft_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES app."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpportunityDraft_publishedOpportunityId_fkey" FOREIGN KEY ("publishedOpportunityId") REFERENCES app."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OpportunityDraft_organizationId_idx" ON app."OpportunityDraft"("organizationId");
CREATE INDEX IF NOT EXISTS "OpportunityDraft_authorUserId_idx" ON app."OpportunityDraft"("authorUserId");

-- 3. CandidateApplication
CREATE TABLE IF NOT EXISTS app."CandidateApplication" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "candidateProfileId" UUID NOT NULL,
    "profileRevisionId" UUID NOT NULL,
    "status" app."CandidateApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "receiptNumber" VARCHAR(100) NOT NULL,
    "consentGivenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(3),
    "withdrawalReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateApplication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CandidateApplication_receiptNumber_key" UNIQUE ("receiptNumber"),
    CONSTRAINT "CandidateApplication_candidateProfileId_opportunityId_key" UNIQUE ("candidateProfileId", "opportunityId"),
    CONSTRAINT "CandidateApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES app."Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CandidateApplication_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES app."CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CandidateApplication_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES app."ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CandidateApplication_opportunityId_status_idx" ON app."CandidateApplication"("opportunityId", "status");
CREATE INDEX IF NOT EXISTS "CandidateApplication_candidateProfileId_idx" ON app."CandidateApplication"("candidateProfileId");

-- 4. Habilitar RLS
ALTER TABLE app."OpportunityDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CandidateApplication" ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies para equipo10_runtime

-- Opportunity INSERT y UPDATE por empresa
DROP POLICY IF EXISTS "Opportunity_insert_employer" ON app."Opportunity";
CREATE POLICY "Opportunity_insert_employer"
ON app."Opportunity"
FOR INSERT
TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."OrganizationMembership" m
        WHERE m."organizationId" = "Opportunity"."organizationId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "Opportunity_update_employer" ON app."Opportunity";
CREATE POLICY "Opportunity_update_employer"
ON app."Opportunity"
FOR UPDATE
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."OrganizationMembership" m
        WHERE m."organizationId" = "Opportunity"."organizationId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

-- OpportunityRequirement INSERT y UPDATE por empresa
DROP POLICY IF EXISTS "OpportunityRequirement_insert_employer" ON app."OpportunityRequirement";
CREATE POLICY "OpportunityRequirement_insert_employer"
ON app."OpportunityRequirement"
FOR INSERT
TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."Opportunity" o
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE o."id" = "OpportunityRequirement"."opportunityId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "OpportunityRequirement_update_employer" ON app."OpportunityRequirement";
CREATE POLICY "OpportunityRequirement_update_employer"
ON app."OpportunityRequirement"
FOR UPDATE
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."Opportunity" o
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE o."id" = "OpportunityRequirement"."opportunityId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

-- OpportunityDraft Policies
DROP POLICY IF EXISTS "OpportunityDraft_select_employer" ON app."OpportunityDraft";
CREATE POLICY "OpportunityDraft_select_employer"
ON app."OpportunityDraft"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."OrganizationMembership" m
        WHERE m."organizationId" = "OpportunityDraft"."organizationId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "OpportunityDraft_insert_employer" ON app."OpportunityDraft";
CREATE POLICY "OpportunityDraft_insert_employer"
ON app."OpportunityDraft"
FOR INSERT
TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."OrganizationMembership" m
        WHERE m."organizationId" = "OpportunityDraft"."organizationId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "OpportunityDraft_update_employer" ON app."OpportunityDraft";
CREATE POLICY "OpportunityDraft_update_employer"
ON app."OpportunityDraft"
FOR UPDATE
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."OrganizationMembership" m
        WHERE m."organizationId" = "OpportunityDraft"."organizationId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

-- CandidateApplication Policies
DROP POLICY IF EXISTS "CandidateApplication_select_candidate" ON app."CandidateApplication";
CREATE POLICY "CandidateApplication_select_candidate"
ON app."CandidateApplication"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p."id" = "CandidateApplication"."candidateProfileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

DROP POLICY IF EXISTS "CandidateApplication_select_employer" ON app."CandidateApplication";
CREATE POLICY "CandidateApplication_select_employer"
ON app."CandidateApplication"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."Opportunity" o
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE o."id" = "CandidateApplication"."opportunityId"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "CandidateApplication_insert_candidate" ON app."CandidateApplication";
CREATE POLICY "CandidateApplication_insert_candidate"
ON app."CandidateApplication"
FOR INSERT
TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p."id" = "CandidateApplication"."candidateProfileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

DROP POLICY IF EXISTS "CandidateApplication_update_candidate" ON app."CandidateApplication";
CREATE POLICY "CandidateApplication_update_candidate"
ON app."CandidateApplication"
FOR UPDATE
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p."id" = "CandidateApplication"."candidateProfileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

-- 5.1 RLS Policies para empleador sobre datos consentidos del candidato
DROP POLICY IF EXISTS "profile_revision_consented_employer" ON app."ProfileRevision";
CREATE POLICY "profile_revision_consented_employer"
ON app."ProfileRevision"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateApplication" a
        JOIN app."Opportunity" o ON o.id = a."opportunityId"
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE a."profileRevisionId" = "ProfileRevision"."id"
          AND a."status" = 'ACTIVE'
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "competency_claim_consented_employer" ON app."CompetencyClaim";
CREATE POLICY "competency_claim_consented_employer"
ON app."CompetencyClaim"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateApplication" a
        JOIN app."Opportunity" o ON o.id = a."opportunityId"
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE a."profileRevisionId" = "CompetencyClaim"."revisionId"
          AND a."status" = 'ACTIVE'
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "evidence_link_consented_employer" ON app."ProfileEvidenceLink";
CREATE POLICY "evidence_link_consented_employer"
ON app."ProfileEvidenceLink"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateApplication" a
        JOIN app."Opportunity" o ON o.id = a."opportunityId"
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE a."profileRevisionId" = "ProfileEvidenceLink"."revisionId"
          AND a."status" = 'ACTIVE'
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

DROP POLICY IF EXISTS "profile_evidence_consented_employer" ON app."ProfileEvidence";
CREATE POLICY "profile_evidence_consented_employer"
ON app."ProfileEvidence"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."ProfileEvidenceLink" l
        JOIN app."CandidateApplication" a ON a."profileRevisionId" = l."revisionId"
        JOIN app."Opportunity" o ON o.id = a."opportunityId"
        JOIN app."OrganizationMembership" m ON m."organizationId" = o."organizationId"
        WHERE l."evidenceId" = "ProfileEvidence"."id"
          AND a."status" = 'ACTIVE'
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
          AND m."role" IN ('ADMIN', 'RECRUITER')
    )
);

-- 6. Privilegios para roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        GRANT SELECT, INSERT, UPDATE ON TABLE app."Opportunity" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app."OpportunityRequirement" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OpportunityDraft" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."CandidateApplication" TO equipo10_runtime;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        GRANT SELECT, INSERT, UPDATE ON TABLE app."Opportunity" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app."OpportunityRequirement" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OpportunityDraft" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."CandidateApplication" TO equipo10_api;
    END IF;
END;
$$;

COMMIT;
