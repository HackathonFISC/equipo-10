BEGIN;

-- 1. Nuevos Enums para D4
CREATE TYPE app."PlanFeasibility" AS ENUM ('VIABLE', 'CONDITIONAL', 'PENDING', 'INVIABLE');
CREATE TYPE app."LearningPlanStatus" AS ENUM ('DRAFT', 'CALCULATED', 'CONFIRMED', 'SUPERSEDED', 'CANCELLED');
CREATE TYPE app."PlanStepType" AS ENUM ('DIRECT', 'CONDITIONAL');
CREATE TYPE app."ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- 2. Tablas Curriculares y Catálogo de Formación
CREATE TABLE app."Course" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Course_code_key" UNIQUE ("code"),
    CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES app."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Course_organizationId_idx" ON app."Course"("organizationId");

CREATE TABLE app."CourseVersion" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "syllabusText" VARCHAR(5000) NOT NULL,
    "durationHours" INTEGER,
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseVersion_courseId_versionNumber_key" UNIQUE ("courseId", "versionNumber"),
    CONSTRAINT "CourseVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES app."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseVersion_catalog_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES app."CatalogVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CourseVersion_catalogVersionId_idx" ON app."CourseVersion"("catalogVersionId");

CREATE TABLE app."CourseLearningOutcome" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseLearningOutcome_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseLearningOutcome_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES app."CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseLearningOutcome_competency_fkey" FOREIGN KEY ("competencyId", "catalogVersionId") REFERENCES app."CompetencyEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CourseLearningOutcome_courseVersionId_idx" ON app."CourseLearningOutcome"("courseVersionId");
CREATE INDEX "CourseLearningOutcome_competency_idx" ON app."CourseLearningOutcome"("competencyId", "catalogVersionId");

CREATE TABLE app."CoursePrerequisite" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "competencyId" UUID NOT NULL,
    "catalogVersionId" UUID NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CoursePrerequisite_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES app."CourseVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoursePrerequisite_competency_fkey" FOREIGN KEY ("competencyId", "catalogVersionId") REFERENCES app."CompetencyEntry"("id", "catalogVersionId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CoursePrerequisite_courseVersionId_idx" ON app."CoursePrerequisite"("courseVersionId");
CREATE INDEX "CoursePrerequisite_competency_idx" ON app."CoursePrerequisite"("competencyId", "catalogVersionId");

CREATE TABLE app."CourseEdition" (
    "id" UUID NOT NULL,
    "courseVersionId" UUID NOT NULL,
    "modality" app."WorkplaceType" NOT NULL DEFAULT 'ON_SITE',
    "location" VARCHAR(200),
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalSlots" INTEGER NOT NULL DEFAULT 1,
    "availableSlots" INTEGER NOT NULL DEFAULT 1,
    "costAmount" DECIMAL(14,2),
    "costCurrency" VARCHAR(3),
    "costPeriod" app."MoneyPeriod",
    "scheduleSummary" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseEdition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseEdition_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES app."CourseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CourseEdition_courseVersionId_idx" ON app."CourseEdition"("courseVersionId");

CREATE TABLE app."CourseSession" (
    "id" UUID NOT NULL,
    "editionId" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startMinute" SMALLINT NOT NULL,
    "endMinute" SMALLINT NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/Panama',
    "location" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseSession_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES app."CourseEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CourseSession_editionId_idx" ON app."CourseSession"("editionId");

-- 3. Planes Formativos
CREATE TABLE app."LearningPlan" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "targetOpportunityId" UUID,
    "targetOccupationId" UUID,
    "catalogVersionId" UUID,
    "status" app."LearningPlanStatus" NOT NULL DEFAULT 'CALCULATED',
    "feasibility" app."PlanFeasibility" NOT NULL DEFAULT 'VIABLE',
    "coverageNumerator" INTEGER NOT NULL DEFAULT 0,
    "coverageDenominator" INTEGER NOT NULL DEFAULT 0,
    "totalCostAmount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "residualGap" TEXT[] NOT NULL DEFAULT '{}',
    "assumptionsJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "reasons" TEXT[] NOT NULL DEFAULT '{}',
    "outdated" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LearningPlan_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES app."CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningPlan_revision_fkey" FOREIGN KEY ("profileId", "revisionId") REFERENCES app."ProfileRevision"("profileId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearningPlan_targetOpportunityId_fkey" FOREIGN KEY ("targetOpportunityId") REFERENCES app."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LearningPlan_profileId_revisionId_idx" ON app."LearningPlan"("profileId", "revisionId");

CREATE TABLE app."LearningPlanStep" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "editionId" UUID NOT NULL,
    "stepOrder" SMALLINT NOT NULL,
    "stepType" app."PlanStepType" NOT NULL DEFAULT 'DIRECT',
    "conditionalPrerequisiteDescription" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningPlanStep_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LearningPlanStep_planId_stepOrder_key" UNIQUE ("planId", "stepOrder"),
    CONSTRAINT "LearningPlanStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES app."LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearningPlanStep_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES app."CourseEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LearningPlanStep_editionId_idx" ON app."LearningPlanStep"("editionId");

CREATE TABLE app."LearningPlanExplanation" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "agentId" VARCHAR(20) NOT NULL DEFAULT 'A05',
    "contractVersion" VARCHAR(30) NOT NULL DEFAULT 'agent-result/1',
    "status" VARCHAR(30) NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "decisionJson" JSONB NOT NULL,
    "missingFieldsJson" JSONB NOT NULL,
    "questionsJson" JSONB NOT NULL,
    "tokenUsage" JSONB,
    "consentGranted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningPlanExplanation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LearningPlanExplanation_planId_fkey" FOREIGN KEY ("planId") REFERENCES app."LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearningPlanExplanation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES app."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LearningPlanExplanation_planId_idx" ON app."LearningPlanExplanation"("planId");
CREATE INDEX "LearningPlanExplanation_actorUserId_idx" ON app."LearningPlanExplanation"("actorUserId");

-- 4. Reservas de Cursos con Unicidad Parcial
CREATE TABLE app."CourseReservation" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "editionId" UUID NOT NULL,
    "planId" UUID,
    "status" app."ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "reservationNumber" VARCHAR(40) NOT NULL,
    "cancellationReason" VARCHAR(500),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseReservation_reservationNumber_key" UNIQUE ("reservationNumber"),
    CONSTRAINT "CourseReservation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES app."CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseReservation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES app."CourseEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseReservation_planId_fkey" FOREIGN KEY ("planId") REFERENCES app."LearningPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CourseReservation_profileId_idx" ON app."CourseReservation"("profileId");
CREATE INDEX "CourseReservation_editionId_idx" ON app."CourseReservation"("editionId");

-- Restricción de unicidad parcial: un candidato no puede tener dos reservas activas para la misma edición
CREATE UNIQUE INDEX "CourseReservation_active_candidate_edition_unique" 
ON app."CourseReservation" ("profileId", "editionId") 
WHERE "status" = 'CONFIRMED';

-- 5. Configuración RLS (Row Level Security)
ALTER TABLE app."Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."Course" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."CourseVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CourseVersion" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."CourseLearningOutcome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CourseLearningOutcome" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."CoursePrerequisite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CoursePrerequisite" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."CourseEdition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CourseEdition" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."CourseSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CourseSession" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."LearningPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."LearningPlan" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."LearningPlanStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."LearningPlanStep" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."LearningPlanExplanation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."LearningPlanExplanation" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."CourseReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CourseReservation" FORCE ROW LEVEL SECURITY;

-- Políticas de lectura de catálogo público/curado
CREATE POLICY "Course_select_active" ON app."Course" FOR SELECT TO equipo10_runtime USING ("active" = true);
CREATE POLICY "Organization_select_active_courses" ON app."Organization" FOR SELECT TO equipo10_runtime USING ("active" = true AND EXISTS (SELECT 1 FROM app."Course" c WHERE c."organizationId" = "Organization"."id" AND c."active" = true));
CREATE POLICY "CourseVersion_select_all" ON app."CourseVersion" FOR SELECT TO equipo10_runtime USING (true);
CREATE POLICY "CourseLearningOutcome_select_all" ON app."CourseLearningOutcome" FOR SELECT TO equipo10_runtime USING (true);
CREATE POLICY "CoursePrerequisite_select_all" ON app."CoursePrerequisite" FOR SELECT TO equipo10_runtime USING (true);
CREATE POLICY "CourseEdition_select_active" ON app."CourseEdition" FOR SELECT TO equipo10_runtime USING ("active" = true);
CREATE POLICY "CourseEdition_update_slots" ON app."CourseEdition" FOR UPDATE TO equipo10_runtime USING (true);
CREATE POLICY "CourseSession_select_all" ON app."CourseSession" FOR SELECT TO equipo10_runtime USING (true);

-- Políticas para LearningPlan (privado del candidato)
CREATE POLICY "LearningPlan_select_own" ON app."LearningPlan" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CandidateProfile" p WHERE p."id" = "LearningPlan"."profileId" AND p."ownerUserId" = app.actor_user_id()));

CREATE POLICY "LearningPlan_insert_own" ON app."LearningPlan" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."CandidateProfile" p WHERE p."id" = "LearningPlan"."profileId" AND p."ownerUserId" = app.actor_user_id()));

CREATE POLICY "LearningPlan_update_own" ON app."LearningPlan" FOR UPDATE TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CandidateProfile" p WHERE p."id" = "LearningPlan"."profileId" AND p."ownerUserId" = app.actor_user_id()));

-- Políticas para LearningPlanStep
CREATE POLICY "LearningPlanStep_select_own" ON app."LearningPlanStep" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."LearningPlan" lp JOIN app."CandidateProfile" p ON p."id" = lp."profileId" WHERE lp."id" = "LearningPlanStep"."planId" AND p."ownerUserId" = app.actor_user_id()));

CREATE POLICY "LearningPlanStep_insert_own" ON app."LearningPlanStep" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."LearningPlan" lp JOIN app."CandidateProfile" p ON p."id" = lp."profileId" WHERE lp."id" = "LearningPlanStep"."planId" AND p."ownerUserId" = app.actor_user_id()));

-- Políticas para LearningPlanExplanation
CREATE POLICY "LearningPlanExplanation_select_own" ON app."LearningPlanExplanation" FOR SELECT TO equipo10_runtime
USING ("actorUserId" = app.actor_user_id());

CREATE POLICY "LearningPlanExplanation_insert_own" ON app."LearningPlanExplanation" FOR INSERT TO equipo10_runtime
WITH CHECK ("actorUserId" = app.actor_user_id());

-- Políticas para CourseReservation
CREATE POLICY "CourseReservation_select_own" ON app."CourseReservation" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CandidateProfile" p WHERE p."id" = "CourseReservation"."profileId" AND p."ownerUserId" = app.actor_user_id()));

CREATE POLICY "CourseReservation_insert_own" ON app."CourseReservation" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."CandidateProfile" p WHERE p."id" = "CourseReservation"."profileId" AND p."ownerUserId" = app.actor_user_id()));

CREATE POLICY "CourseReservation_update_own" ON app."CourseReservation" FOR UPDATE TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CandidateProfile" p WHERE p."id" = "CourseReservation"."profileId" AND p."ownerUserId" = app.actor_user_id()));

-- Función segura para cálculo vivo de capacidad que trasciende el RLS privado del candidato
CREATE OR REPLACE FUNCTION app.count_active_reservations(target_edition_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, pg_temp
AS $$
  SELECT COUNT(*)::integer
  FROM app."CourseReservation"
  WHERE "editionId" = target_edition_id AND "status" = 'CONFIRMED';
$$;

-- Permisos SQL para roles de runtime y login
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        GRANT SELECT ON TABLE app."Course" TO equipo10_runtime;
        GRANT SELECT ON TABLE app."CourseVersion" TO equipo10_runtime;
        GRANT SELECT ON TABLE app."CourseLearningOutcome" TO equipo10_runtime;
        GRANT SELECT ON TABLE app."CoursePrerequisite" TO equipo10_runtime;
        GRANT SELECT, UPDATE ON TABLE app."CourseEdition" TO equipo10_runtime;
        GRANT SELECT ON TABLE app."CourseSession" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."LearningPlan" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."LearningPlanStep" TO equipo10_runtime;
        GRANT SELECT, INSERT ON TABLE app."LearningPlanExplanation" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."CourseReservation" TO equipo10_runtime;
        GRANT EXECUTE ON FUNCTION app.count_active_reservations(uuid) TO equipo10_runtime;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        GRANT SELECT ON TABLE app."Course" TO equipo10_api;
        GRANT SELECT ON TABLE app."CourseVersion" TO equipo10_api;
        GRANT SELECT ON TABLE app."CourseLearningOutcome" TO equipo10_api;
        GRANT SELECT ON TABLE app."CoursePrerequisite" TO equipo10_api;
        GRANT SELECT, UPDATE ON TABLE app."CourseEdition" TO equipo10_api;
        GRANT SELECT ON TABLE app."CourseSession" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."LearningPlan" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."LearningPlanStep" TO equipo10_api;
        GRANT SELECT, INSERT ON TABLE app."LearningPlanExplanation" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."CourseReservation" TO equipo10_api;
        GRANT EXECUTE ON FUNCTION app.count_active_reservations(uuid) TO equipo10_api;
    END IF;
END;
$$;

COMMIT;
