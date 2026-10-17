BEGIN;

CREATE TYPE app."WorkplaceType" AS ENUM ('REMOTE', 'ON_SITE', 'HYBRID');
CREATE TYPE app."RequirementType" AS ENUM ('ESSENTIAL', 'DESIRABLE');
CREATE TYPE app."RequirementStage" AS ENUM ('ENTRY', 'TRAINABLE');
CREATE TYPE app."ComparisonFeasibility" AS ENUM ('VIABLE', 'INVIABLE', 'PENDIENTE');

CREATE TABLE app."Opportunity" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "occupationId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "workplaceType" app."WorkplaceType" NOT NULL DEFAULT 'ON_SITE',
    "salaryAmount" DECIMAL(14,2),
    "salaryCurrency" VARCHAR(3),
    "salaryPeriod" app."MoneyPeriod",
    "scheduleSummary" VARCHAR(200),
    "availableSlots" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES app."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_occupation_fkey" FOREIGN KEY ("occupationId", "catalogVersionId") REFERENCES app."OccupationEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_catalog_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES app."CatalogVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Opportunity_organizationId_idx" ON app."Opportunity"("organizationId");
CREATE INDEX "Opportunity_occupation_idx" ON app."Opportunity"("occupationId", "catalogVersionId");

CREATE TABLE app."OpportunityRequirement" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "requirementType" app."RequirementType" NOT NULL DEFAULT 'ESSENTIAL',
    "stage" app."RequirementStage" NOT NULL DEFAULT 'ENTRY',
    "description" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityRequirement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpportunityRequirement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES app."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityRequirement_competency_fkey" FOREIGN KEY ("competencyId", "catalogVersionId") REFERENCES app."CompetencyEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OpportunityRequirement_opportunityId_idx" ON app."OpportunityRequirement"("opportunityId");
CREATE INDEX "OpportunityRequirement_competency_idx" ON app."OpportunityRequirement"("competencyId", "catalogVersionId");

CREATE TABLE app."OpportunityComparison" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "opportunityVersion" INTEGER NOT NULL,
    "status" app."ComparisonFeasibility" NOT NULL,
    "coverageNumerator" INTEGER NOT NULL,
    "coverageDenominator" INTEGER NOT NULL,
    "coveragePercent" DECIMAL(5,2),
    "assumptionsJson" JSONB NOT NULL DEFAULT '{}',
    "breakdownJson" JSONB NOT NULL DEFAULT '{}',
    "reasons" TEXT[] NOT NULL DEFAULT '{}',
    "outdated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityComparison_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpportunityComparison_profile_fkey" FOREIGN KEY ("profileId") REFERENCES app."CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpportunityComparison_revision_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES app."ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OpportunityComparison_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES app."Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OpportunityComparison_profile_revision_idx" ON app."OpportunityComparison"("profileId", "revisionId");
CREATE INDEX "OpportunityComparison_opportunityId_idx" ON app."OpportunityComparison"("opportunityId");

CREATE TABLE app."OpportunityExplanation" (
    "id" UUID NOT NULL,
    "comparisonId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "agentId" VARCHAR(20) NOT NULL DEFAULT 'A03',
    "contractVersion" VARCHAR(30) NOT NULL DEFAULT 'agent-result/1',
    "status" VARCHAR(30) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "decisionJson" JSONB NOT NULL DEFAULT '{}',
    "missingFieldsJson" JSONB NOT NULL DEFAULT '[]',
    "questionsJson" JSONB NOT NULL DEFAULT '[]',
    "tokenUsage" JSONB,
    "consentGranted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpportunityExplanation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpportunityExplanation_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES app."OpportunityComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityExplanation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES app."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OpportunityExplanation_comparisonId_idx" ON app."OpportunityExplanation"("comparisonId");
CREATE INDEX "OpportunityExplanation_actorUserId_idx" ON app."OpportunityExplanation"("actorUserId");

-- Habilitar RLS
ALTER TABLE app."Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OpportunityRequirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OpportunityComparison" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OpportunityExplanation" ENABLE ROW LEVEL SECURITY;

-- Revocar permisos publicos
REVOKE ALL ON TABLE app."Opportunity" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app."OpportunityRequirement" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app."OpportunityComparison" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app."OpportunityExplanation" FROM PUBLIC, anon, authenticated;

-- Politicas para equipo10_runtime
CREATE POLICY "Opportunity_select_active"
ON app."Opportunity"
FOR SELECT
TO equipo10_runtime
USING ("active" = true);

CREATE POLICY "OpportunityRequirement_select_active"
ON app."OpportunityRequirement"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."Opportunity" o
        WHERE o."id" = "OpportunityRequirement"."opportunityId"
          AND o."active" = true
    )
);

CREATE POLICY "Organization_select_active_opportunities"
ON app."Organization"
FOR SELECT
TO equipo10_runtime
USING (
    "active" = true
    AND EXISTS (
        SELECT 1
        FROM app."Opportunity" o
        WHERE o."organizationId" = "Organization"."id"
          AND o."active" = true
    )
);

CREATE POLICY "OpportunityComparison_select_own"
ON app."OpportunityComparison"
FOR SELECT
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p."id" = "OpportunityComparison"."profileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

CREATE POLICY "OpportunityComparison_insert_own"
ON app."OpportunityComparison"
FOR INSERT
TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p."id" = "OpportunityComparison"."profileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

CREATE POLICY "OpportunityComparison_update_own"
ON app."OpportunityComparison"
FOR UPDATE
TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p."id" = "OpportunityComparison"."profileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

CREATE POLICY "OpportunityExplanation_select_own"
ON app."OpportunityExplanation"
FOR SELECT
TO equipo10_runtime
USING ("actorUserId" = app.actor_user_id());

CREATE POLICY "OpportunityExplanation_insert_own"
ON app."OpportunityExplanation"
FOR INSERT
TO equipo10_runtime
WITH CHECK ("actorUserId" = app.actor_user_id());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        GRANT SELECT ON TABLE app."Opportunity" TO equipo10_runtime;
        GRANT SELECT ON TABLE app."OpportunityRequirement" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OpportunityComparison" TO equipo10_runtime;
        GRANT SELECT, INSERT ON TABLE app."OpportunityExplanation" TO equipo10_runtime;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        GRANT SELECT ON TABLE app."Opportunity" TO equipo10_api;
        GRANT SELECT ON TABLE app."OpportunityRequirement" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OpportunityComparison" TO equipo10_api;
        GRANT SELECT, INSERT ON TABLE app."OpportunityExplanation" TO equipo10_api;
    END IF;
END;
$$;

COMMIT;
