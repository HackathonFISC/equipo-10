BEGIN;

-- Verificación y creación restrictiva del rol de runtime equipo10_runtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
    CREATE ROLE equipo10_runtime WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSE
    -- Si el rol ya existe, verificar que no tenga privilegios administrativos, capacidad de login ni BYPASSRLS
    IF EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolname = 'equipo10_runtime'
        AND (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role attributes violate least-privilege';
    END IF;

    -- Rechazar si es miembro de otros roles
    IF EXISTS (
      SELECT 1 FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid
      WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = 'equipo10_runtime')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role cannot inherit memberships';
    END IF;

    -- Rechazar si es owner de la base de datos actual
    IF EXISTS (
      SELECT 1 FROM pg_database d
      JOIN pg_roles r ON r.oid = d.datdba
      WHERE d.datname = current_database() AND r.rolname = 'equipo10_runtime'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role cannot own database';
    END IF;

    -- Rechazar si es owner del esquema app
    IF (SELECT pg_catalog.pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'app') = 'equipo10_runtime' THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role cannot own schema app';
    END IF;

    -- Rechazar si es owner de tablas en app
    IF EXISTS (
      SELECT 1 FROM pg_tables t
      JOIN pg_roles r ON r.rolname = t.tableowner
      WHERE t.schemaname = 'app' AND r.rolname = 'equipo10_runtime'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role cannot own app tables';
    END IF;

    -- Rechazar si es owner de funciones/procedimientos en app
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'app' AND r.rolname = 'equipo10_runtime'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role cannot own app routines';
    END IF;

    -- Rechazar si es owner de tipos en app
    IF EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_roles r ON r.oid = t.typowner
      WHERE n.nspname = 'app' AND r.rolname = 'equipo10_runtime'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'insecure_or_privileged_runtime_role: role cannot own app types';
    END IF;
  END IF;
END $$;

-- Rechazar si ya existen políticas en el esquema app antes de mutar (prohibido mutar silenciosamente)
DO $$ DECLARE cnt int; BEGIN
  SELECT count(*)::int INTO cnt FROM pg_policies WHERE schemaname = 'app';
  IF cnt > 0 THEN
    RAISE EXCEPTION USING ERRCODE = '42710', MESSAGE = 'policies_already_exist_in_schema_app';
  END IF;
END $$;

-- Revocación preventiva de todos los privilegios sobre objetos del esquema app
REVOKE ALL ON SCHEMA app FROM equipo10_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM equipo10_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM equipo10_runtime;
REVOKE ALL ON ALL ROUTINES IN SCHEMA app FROM equipo10_runtime;

GRANT USAGE ON SCHEMA app TO equipo10_runtime;

-- Funciones auxiliares de contexto con revocación explícita de PUBLIC
CREATE OR REPLACE FUNCTION app.actor_user_id() RETURNS uuid STABLE LANGUAGE sql AS $$
  SELECT nullif(current_setting('app.actor_user_id', true), '')::uuid;
$$;

REVOKE ALL ON FUNCTION app.actor_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.actor_user_id() TO equipo10_runtime;

CREATE OR REPLACE FUNCTION app.is_candidate_profile_owner(p_profile_id uuid) RETURNS boolean STABLE LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM app."CandidateProfile" p
    WHERE p.id = p_profile_id AND p."ownerUserId" = app.actor_user_id()
  );
$$;

REVOKE ALL ON FUNCTION app.is_candidate_profile_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_candidate_profile_owner(uuid) TO equipo10_runtime;

-- Activar RLS en todas las tablas del esquema app SIN FORCE RLS
-- (los roles migradores/bootstrap sin superuser mantienen acceso de gestión)
DO $$ DECLARE tab text; BEGIN
  FOR tab IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY;', tab);
  END LOOP;
END $$;

-- Catálogos: SELECT únicamente cuando existe un actor activo en el contexto de transacción
GRANT SELECT ON app."CatalogVersion", app."OccupationEntry", app."OccupationAlias",
                app."CompetencyEntry", app."CompetencyAlias" TO equipo10_runtime;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['CatalogVersion','OccupationEntry','OccupationAlias','CompetencyEntry','CompetencyAlias'] LOOP
    EXECUTE format('CREATE POLICY catalog_actor_ro ON app.%I FOR SELECT TO equipo10_runtime USING (app.actor_user_id() IS NOT NULL);', tab);
  END LOOP;
END $$;

-- AppUser: SELECT del propio actor
GRANT SELECT ON app."AppUser" TO equipo10_runtime;
CREATE POLICY appuser_self_ro ON app."AppUser" FOR SELECT TO equipo10_runtime
  USING (id = app.actor_user_id());

-- CandidateProfile: el candidato es el ownerUserId
GRANT SELECT, INSERT, UPDATE ON app."CandidateProfile" TO equipo10_runtime;
CREATE POLICY candidate_profile_own ON app."CandidateProfile" FOR ALL TO equipo10_runtime
  USING ("ownerUserId" = app.actor_user_id())
  WITH CHECK ("ownerUserId" = app.actor_user_id());

-- ProfileRevision: revisiones pertenecientes al perfil del actor
GRANT SELECT, INSERT, UPDATE ON app."ProfileRevision" TO equipo10_runtime;
CREATE POLICY profile_revision_own ON app."ProfileRevision" FOR ALL TO equipo10_runtime
  USING (app.is_candidate_profile_owner("profileId"))
  WITH CHECK (app.is_candidate_profile_owner("profileId"));

-- Hijos directos con columna profileId mutables en DRAFT
DO $$ DECLARE tab text; pol text; BEGIN
  FOREACH tab IN ARRAY ARRAY['ProfileExperience','TrainingDeclaration','JobInterest','CompetencyClaim',
                            'ProfileConstraints','AvailabilityWindow','AvailabilityException','ProfileEvidenceLink'] LOOP
    pol := tab || '_own';
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON app.%I TO equipo10_runtime;', tab);
    EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL TO equipo10_runtime
      USING (app.is_candidate_profile_owner("profileId"))
      WITH CHECK (app.is_candidate_profile_owner("profileId"));', pol, tab);
  END LOOP;
END $$;

-- ExceptionInterval: hijo de AvailabilityException
GRANT SELECT, INSERT, UPDATE, DELETE ON app."ExceptionInterval" TO equipo10_runtime;
CREATE POLICY exception_interval_own ON app."ExceptionInterval" FOR ALL TO equipo10_runtime
  USING (EXISTS (
    SELECT 1 FROM app."AvailabilityException" e
    WHERE e.id = "exceptionId" AND app.is_candidate_profile_owner(e."profileId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app."AvailabilityException" e
    WHERE e.id = "exceptionId" AND app.is_candidate_profile_owner(e."profileId")
  ));

-- Fuentes documentales y evidencias del candidato
GRANT SELECT, INSERT, UPDATE ON app."ProfileSource" TO equipo10_runtime;
CREATE POLICY profile_source_own ON app."ProfileSource" FOR ALL TO equipo10_runtime
  USING (app.is_candidate_profile_owner("profileId"))
  WITH CHECK (app.is_candidate_profile_owner("profileId"));

DO $$ DECLARE tab text; pol text; BEGIN
  FOREACH tab IN ARRAY ARRAY['SourceFragment','ProfileEvidence'] LOOP
    pol := tab || '_own';
    EXECUTE format('GRANT SELECT, INSERT ON app.%I TO equipo10_runtime;', tab);
    EXECUTE format('CREATE POLICY %I ON app.%I FOR ALL TO equipo10_runtime
      USING (app.is_candidate_profile_owner("profileId"))
      WITH CHECK (app.is_candidate_profile_owner("profileId"));', pol, tab);
  END LOOP;
END $$;

-- Revisiones de sección
GRANT SELECT, INSERT, UPDATE, DELETE ON app."SectionReview" TO equipo10_runtime;
CREATE POLICY section_review_own ON app."SectionReview" FOR ALL TO equipo10_runtime
  USING ("actorUserId" = app.actor_user_id() AND EXISTS (
    SELECT 1 FROM app."ProfileRevision" r
    WHERE r.id = "revisionId" AND app.is_candidate_profile_owner(r."profileId")
  ))
  WITH CHECK ("actorUserId" = app.actor_user_id() AND EXISTS (
    SELECT 1 FROM app."ProfileRevision" r
    WHERE r.id = "revisionId" AND app.is_candidate_profile_owner(r."profileId")
  ));

-- ProfilePreview: no tiene columna de actor propia; se valida a través de revisionId del perfil propio
GRANT SELECT, INSERT ON app."ProfilePreview" TO equipo10_runtime;
CREATE POLICY profile_preview_own ON app."ProfilePreview" FOR ALL TO equipo10_runtime
  USING (EXISTS (
    SELECT 1 FROM app."ProfileRevision" r
    WHERE r.id = "revisionId" AND app.is_candidate_profile_owner(r."profileId")
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM app."ProfileRevision" r
    WHERE r.id = "revisionId" AND app.is_candidate_profile_owner(r."profileId")
  ));

-- ProfileConfirmation: valida pertenencia de la revisión, preview correspondiente y operación de actor/perfil propio sin recursión
GRANT SELECT, INSERT ON app."ProfileConfirmation" TO equipo10_runtime;
CREATE POLICY profile_confirmation_own ON app."ProfileConfirmation" FOR ALL TO equipo10_runtime
  USING (
    "ProfileConfirmation"."actorUserId" = app.actor_user_id()
    AND EXISTS (
      SELECT 1 FROM app."ProfileRevision" r
      WHERE r.id = "ProfileConfirmation"."revisionId" AND app.is_candidate_profile_owner(r."profileId")
    )
    AND EXISTS (
      SELECT 1 FROM app."ProfilePreview" prev
      WHERE prev.id = "ProfileConfirmation"."previewId" AND prev."revisionId" = "ProfileConfirmation"."revisionId"
    )
    AND EXISTS (
      SELECT 1 FROM app."OperationReceipt" op
      JOIN app."ProfileRevision" r ON r.id = "ProfileConfirmation"."revisionId"
      WHERE op.id = "ProfileConfirmation"."operationId"
        AND op."actorUserId" = app.actor_user_id()
        AND (op."profileId" IS NULL OR op."profileId" = r."profileId")
    )
  )
  WITH CHECK (
    "ProfileConfirmation"."actorUserId" = app.actor_user_id()
    AND EXISTS (
      SELECT 1 FROM app."ProfileRevision" r
      WHERE r.id = "ProfileConfirmation"."revisionId" AND app.is_candidate_profile_owner(r."profileId")
    )
    AND EXISTS (
      SELECT 1 FROM app."ProfilePreview" prev
      WHERE prev.id = "ProfileConfirmation"."previewId" AND prev."revisionId" = "ProfileConfirmation"."revisionId"
    )
    AND EXISTS (
      SELECT 1 FROM app."OperationReceipt" op
      JOIN app."ProfileRevision" r ON r.id = "ProfileConfirmation"."revisionId"
      WHERE op.id = "ProfileConfirmation"."operationId"
        AND op."actorUserId" = app.actor_user_id()
        AND (op."profileId" IS NULL OR op."profileId" = r."profileId")
    )
  );

-- OperationReceipt: operaciones donde el actor es el solicitante y, si especifica profileId, debe ser su propio perfil
GRANT SELECT, INSERT ON app."OperationReceipt" TO equipo10_runtime;
CREATE POLICY operation_receipt_own ON app."OperationReceipt" FOR ALL TO equipo10_runtime
  USING (
    "actorUserId" = app.actor_user_id()
    AND ("profileId" IS NULL OR app.is_candidate_profile_owner("profileId"))
  )
  WITH CHECK (
    "actorUserId" = app.actor_user_id()
    AND ("profileId" IS NULL OR app.is_candidate_profile_owner("profileId"))
  );

-- AuditEvent: eventos donde el actor coincide y referencias cruzadas (profileId, revisionId, operationId) pertenecen al actor
GRANT SELECT, INSERT ON app."AuditEvent" TO equipo10_runtime;
CREATE POLICY audit_event_own ON app."AuditEvent" FOR ALL TO equipo10_runtime
  USING (
    "AuditEvent"."actorUserId" = app.actor_user_id()
    AND ("AuditEvent"."profileId" IS NULL OR app.is_candidate_profile_owner("AuditEvent"."profileId"))
    AND ("AuditEvent"."revisionId" IS NULL OR EXISTS (
      SELECT 1 FROM app."ProfileRevision" r
      WHERE r.id = "AuditEvent"."revisionId"
        AND app.is_candidate_profile_owner(r."profileId")
        AND ("AuditEvent"."profileId" IS NULL OR "AuditEvent"."profileId" = r."profileId")
    ))
    AND ("AuditEvent"."operationId" IS NULL OR EXISTS (
      SELECT 1 FROM app."OperationReceipt" op
      WHERE op.id = "AuditEvent"."operationId"
        AND op."actorUserId" = app.actor_user_id()
        AND ("AuditEvent"."profileId" IS NULL OR op."profileId" IS NULL OR op."profileId" = "AuditEvent"."profileId")
    ))
  )
  WITH CHECK (
    "AuditEvent"."actorUserId" = app.actor_user_id()
    AND ("AuditEvent"."profileId" IS NULL OR app.is_candidate_profile_owner("AuditEvent"."profileId"))
    AND ("AuditEvent"."revisionId" IS NULL OR EXISTS (
      SELECT 1 FROM app."ProfileRevision" r
      WHERE r.id = "AuditEvent"."revisionId"
        AND app.is_candidate_profile_owner(r."profileId")
        AND ("AuditEvent"."profileId" IS NULL OR "AuditEvent"."profileId" = r."profileId")
    ))
    AND ("AuditEvent"."operationId" IS NULL OR EXISTS (
      SELECT 1 FROM app."OperationReceipt" op
      WHERE op.id = "AuditEvent"."operationId"
        AND op."actorUserId" = app.actor_user_id()
        AND ("AuditEvent"."profileId" IS NULL OR op."profileId" IS NULL OR op."profileId" = "AuditEvent"."profileId")
    ))
  );

COMMIT;
