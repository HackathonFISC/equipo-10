BEGIN;

-- 1. Enums para D8
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrientationRequestStatus') THEN
        CREATE TYPE app."OrientationRequestStatus" AS ENUM (
            'REQUESTED',
            'IN_REVIEW',
            'CLARIFICATION_REQUESTED',
            'APPROVED',
            'REJECTED',
            'OUTDATED',
            'REVOKED'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrientationReviewDecision') THEN
        CREATE TYPE app."OrientationReviewDecision" AS ENUM (
            'APPROVED',
            'REJECTED',
            'CLARIFICATION_NEEDED'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClarificationDecision') THEN
        CREATE TYPE app."ClarificationDecision" AS ENUM (
            'PENDING',
            'ACCEPTED',
            'REJECTED'
        );
    END IF;
END;
$$;

-- 2. OrientationCounselor
CREATE TABLE IF NOT EXISTS app."OrientationCounselor" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "specialty" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrientationCounselor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrientationCounselor_userId_key" UNIQUE ("userId"),
    CONSTRAINT "OrientationCounselor_userId_fkey" FOREIGN KEY ("userId") REFERENCES app."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrientationCounselor_active_idx" ON app."OrientationCounselor"("active");

-- 3. OrientationEngagement
CREATE TABLE IF NOT EXISTS app."OrientationEngagement" (
    "id" UUID NOT NULL,
    "candidateProfileId" UUID NOT NULL,
    "counselorId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "revisionId" UUID NOT NULL,
    "targetOpportunityId" UUID,
    "targetOpportunityVersion" INTEGER,
    "purpose" VARCHAR(500),
    "status" app."OrientationRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "statusReason" VARCHAR(500),
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "revocationReason" VARCHAR(500),
    "receiptNumber" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrientationEngagement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrientationEngagement_receiptNumber_key" UNIQUE ("receiptNumber"),
    CONSTRAINT "OrientationEngagement_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES app."CandidateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrientationEngagement_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES app."OrientationCounselor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrientationEngagement_planId_fkey" FOREIGN KEY ("planId") REFERENCES app."LearningPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrientationEngagement_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES app."ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrientationEngagement_targetOpportunityId_fkey" FOREIGN KEY ("targetOpportunityId") REFERENCES app."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrientationEngagement_candidateProfileId_status_idx" ON app."OrientationEngagement"("candidateProfileId", "status");
CREATE INDEX IF NOT EXISTS "OrientationEngagement_counselorId_status_idx" ON app."OrientationEngagement"("counselorId", "status");
CREATE INDEX IF NOT EXISTS "OrientationEngagement_planId_planVersion_idx" ON app."OrientationEngagement"("planId", "planVersion");

-- 4. OrientationReview
CREATE TABLE IF NOT EXISTS app."OrientationReview" (
    "id" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "counselorUserId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "revisionId" UUID NOT NULL,
    "decision" app."OrientationReviewDecision" NOT NULL,
    "motivation" VARCHAR(2000) NOT NULL,
    "reasons" JSONB NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrientationReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrientationReview_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES app."OrientationEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrientationReview_counselorUserId_fkey" FOREIGN KEY ("counselorUserId") REFERENCES app."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrientationReview_engagementId_idx" ON app."OrientationReview"("engagementId");
CREATE INDEX IF NOT EXISTS "OrientationReview_planId_planVersion_idx" ON app."OrientationReview"("planId", "planVersion");

-- 5. OrientationClarification
CREATE TABLE IF NOT EXISTS app."OrientationClarification" (
    "id" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "question" VARCHAR(1000) NOT NULL,
    "proposedCorrection" VARCHAR(1000),
    "youthDecision" app."ClarificationDecision" NOT NULL DEFAULT 'PENDING',
    "youthResponse" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ(3),
    CONSTRAINT "OrientationClarification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrientationClarification_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES app."OrientationEngagement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrientationClarification_engagementId_youthDecision_idx" ON app."OrientationClarification"("engagementId", "youthDecision");

-- 6. Habilitar RLS
ALTER TABLE app."OrientationCounselor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OrientationEngagement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OrientationReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OrientationClarification" ENABLE ROW LEVEL SECURITY;

-- 7. Funciones auxiliares de verificación para políticas
CREATE OR REPLACE FUNCTION app.counselor_has_active_engagement_for_plan(target_plan_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
    SELECT EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e."planId" = target_plan_id
          AND c."userId" = app.actor_user_id()
          AND c.active = true
          AND e.status NOT IN ('REVOKED')
    );
$$;
REVOKE ALL ON FUNCTION app.counselor_has_active_engagement_for_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.counselor_has_active_engagement_for_plan(uuid) TO equipo10_runtime;

CREATE OR REPLACE FUNCTION app.counselor_has_active_engagement_for_revision(target_revision_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
    SELECT EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e."revisionId" = target_revision_id
          AND c."userId" = app.actor_user_id()
          AND c.active = true
          AND e.status NOT IN ('REVOKED')
    );
$$;
REVOKE ALL ON FUNCTION app.counselor_has_active_engagement_for_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.counselor_has_active_engagement_for_revision(uuid) TO equipo10_runtime;

CREATE OR REPLACE FUNCTION app.counselor_has_active_engagement_for_profile(target_profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
    SELECT EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e."candidateProfileId" = target_profile_id
          AND c."userId" = app.actor_user_id()
          AND c.active = true
          AND e.status NOT IN ('REVOKED')
    );
$$;
REVOKE ALL ON FUNCTION app.counselor_has_active_engagement_for_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.counselor_has_active_engagement_for_profile(uuid) TO equipo10_runtime;

-- 8. RLS Policies para equipo10_runtime

-- OrientationCounselor: lectura pública autenticada de orientadores activos
DROP POLICY IF EXISTS "OrientationCounselor_select_all" ON app."OrientationCounselor";
CREATE POLICY "OrientationCounselor_select_all"
ON app."OrientationCounselor" FOR SELECT TO equipo10_runtime
USING (active = true OR "userId" = app.actor_user_id());

-- OrientationEngagement:
-- Candidato ve sus solicitudes
DROP POLICY IF EXISTS "OrientationEngagement_candidate_select" ON app."OrientationEngagement";
CREATE POLICY "OrientationEngagement_candidate_select"
ON app."OrientationEngagement" FOR SELECT TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p.id = "OrientationEngagement"."candidateProfileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

-- Candidato inserta solicitudes
DROP POLICY IF EXISTS "OrientationEngagement_candidate_insert" ON app."OrientationEngagement";
CREATE POLICY "OrientationEngagement_candidate_insert"
ON app."OrientationEngagement" FOR INSERT TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p.id = "OrientationEngagement"."candidateProfileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

-- Candidato actualiza (revoca o actualiza estado)
DROP POLICY IF EXISTS "OrientationEngagement_candidate_update" ON app."OrientationEngagement";
CREATE POLICY "OrientationEngagement_candidate_update"
ON app."OrientationEngagement" FOR UPDATE TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."CandidateProfile" p
        WHERE p.id = "OrientationEngagement"."candidateProfileId"
          AND p."ownerUserId" = app.actor_user_id()
    )
);

-- Orientador ve solicitudes vigentes dirigidas a él (corta acceso si REVOKED)
DROP POLICY IF EXISTS "OrientationEngagement_counselor_select" ON app."OrientationEngagement";
CREATE POLICY "OrientationEngagement_counselor_select"
ON app."OrientationEngagement" FOR SELECT TO equipo10_runtime
USING (
    status != 'REVOKED' AND EXISTS (
        SELECT 1 FROM app."OrientationCounselor" c
        WHERE c.id = "OrientationEngagement"."counselorId"
          AND c."userId" = app.actor_user_id()
          AND c.active = true
    )
);

-- Orientador actualiza estado (por ejemplo pasando a IN_REVIEW, APPROVED o REJECTED)
DROP POLICY IF EXISTS "OrientationEngagement_counselor_update" ON app."OrientationEngagement";
CREATE POLICY "OrientationEngagement_counselor_update"
ON app."OrientationEngagement" FOR UPDATE TO equipo10_runtime
USING (
    status != 'REVOKED' AND EXISTS (
        SELECT 1 FROM app."OrientationCounselor" c
        WHERE c.id = "OrientationEngagement"."counselorId"
          AND c."userId" = app.actor_user_id()
          AND c.active = true
    )
);

-- OrientationReview:
DROP POLICY IF EXISTS "OrientationReview_select" ON app."OrientationReview";
CREATE POLICY "OrientationReview_select"
ON app."OrientationReview" FOR SELECT TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."CandidateProfile" p ON p.id = e."candidateProfileId"
        WHERE e.id = "OrientationReview"."engagementId"
          AND p."ownerUserId" = app.actor_user_id()
    )
    OR
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e.id = "OrientationReview"."engagementId"
          AND c."userId" = app.actor_user_id()
          AND e.status != 'REVOKED'
    )
);

DROP POLICY IF EXISTS "OrientationReview_insert_counselor" ON app."OrientationReview";
CREATE POLICY "OrientationReview_insert_counselor"
ON app."OrientationReview" FOR INSERT TO equipo10_runtime
WITH CHECK (
    "counselorUserId" = app.actor_user_id() AND EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e.id = "OrientationReview"."engagementId"
          AND c."userId" = app.actor_user_id()
          AND c.active = true
          AND e.status NOT IN ('REVOKED', 'OUTDATED')
    )
);

-- OrientationClarification:
DROP POLICY IF EXISTS "OrientationClarification_select" ON app."OrientationClarification";
CREATE POLICY "OrientationClarification_select"
ON app."OrientationClarification" FOR SELECT TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."CandidateProfile" p ON p.id = e."candidateProfileId"
        WHERE e.id = "OrientationClarification"."engagementId"
          AND p."ownerUserId" = app.actor_user_id()
    )
    OR
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e.id = "OrientationClarification"."engagementId"
          AND c."userId" = app.actor_user_id()
          AND e.status != 'REVOKED'
    )
);

DROP POLICY IF EXISTS "OrientationClarification_insert_counselor" ON app."OrientationClarification";
CREATE POLICY "OrientationClarification_insert_counselor"
ON app."OrientationClarification" FOR INSERT TO equipo10_runtime
WITH CHECK (
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e.id = "OrientationClarification"."engagementId"
          AND c."userId" = app.actor_user_id()
          AND c.active = true
          AND e.status NOT IN ('REVOKED')
    )
);

DROP POLICY IF EXISTS "OrientationClarification_update" ON app."OrientationClarification";
CREATE POLICY "OrientationClarification_update"
ON app."OrientationClarification" FOR UPDATE TO equipo10_runtime
USING (
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."CandidateProfile" p ON p.id = e."candidateProfileId"
        WHERE e.id = "OrientationClarification"."engagementId"
          AND p."ownerUserId" = app.actor_user_id()
    )
    OR
    EXISTS (
        SELECT 1 FROM app."OrientationEngagement" e
        JOIN app."OrientationCounselor" c ON c.id = e."counselorId"
        WHERE e.id = "OrientationClarification"."engagementId"
          AND c."userId" = app.actor_user_id()
          AND e.status != 'REVOKED'
    )
);

-- 9. Accesos de lectura consentidos para el orientador a los datos de la ruta y perfil
DROP POLICY IF EXISTS "learning_plan_counselor_access" ON app."LearningPlan";
CREATE POLICY "learning_plan_counselor_access" ON app."LearningPlan" FOR SELECT TO equipo10_runtime
USING (app.counselor_has_active_engagement_for_plan(id));

DROP POLICY IF EXISTS "learning_plan_step_counselor_access" ON app."LearningPlanStep";
CREATE POLICY "learning_plan_step_counselor_access" ON app."LearningPlanStep" FOR SELECT TO equipo10_runtime
USING (app.counselor_has_active_engagement_for_plan("planId"));

DROP POLICY IF EXISTS "learning_plan_explanation_counselor_access" ON app."LearningPlanExplanation";
CREATE POLICY "learning_plan_explanation_counselor_access" ON app."LearningPlanExplanation" FOR SELECT TO equipo10_runtime
USING (app.counselor_has_active_engagement_for_plan("planId"));

DROP POLICY IF EXISTS "profile_revision_counselor_access" ON app."ProfileRevision";
CREATE POLICY "profile_revision_counselor_access" ON app."ProfileRevision" FOR SELECT TO equipo10_runtime
USING (app.counselor_has_active_engagement_for_revision(id));

DROP POLICY IF EXISTS "constraints_counselor_access" ON app."ProfileConstraints";
CREATE POLICY "constraints_counselor_access" ON app."ProfileConstraints" FOR SELECT TO equipo10_runtime
USING (app.counselor_has_active_engagement_for_revision("revisionId"));

DROP POLICY IF EXISTS "candidate_profile_counselor_access" ON app."CandidateProfile";
CREATE POLICY "candidate_profile_counselor_access" ON app."CandidateProfile" FOR SELECT TO equipo10_runtime
USING (app.counselor_has_active_engagement_for_profile(id));

-- 10. Privilegios para roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationCounselor" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationEngagement" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationReview" TO equipo10_runtime;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationClarification" TO equipo10_runtime;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationCounselor" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationEngagement" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationReview" TO equipo10_api;
        GRANT SELECT, INSERT, UPDATE ON TABLE app."OrientationClarification" TO equipo10_api;
    END IF;
END;
$$;

COMMIT;
