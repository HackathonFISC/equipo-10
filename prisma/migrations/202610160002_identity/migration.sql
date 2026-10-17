BEGIN;

CREATE TYPE app."OrganizationType" AS ENUM ('COMPANY', 'TRAINING_CENTER');
CREATE TYPE app."MembershipRole" AS ENUM ('ADMIN', 'RECRUITER', 'TRAINING_MANAGER');
CREATE TYPE app."MembershipStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE app."Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" app."OrganizationType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE app."OrganizationMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" app."MembershipRole" NOT NULL,
    "status" app."MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES app."AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES app."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON app."OrganizationMembership"("userId", "organizationId");
CREATE INDEX "OrganizationMembership_organizationId_idx" ON app."OrganizationMembership"("organizationId");

CREATE OR REPLACE FUNCTION app.enforce_organization_type_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."type" IS DISTINCT FROM OLD."type" THEN
        RAISE EXCEPTION 'Organization type is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER organization_type_immutability_trigger
BEFORE UPDATE ON app."Organization"
FOR EACH ROW
EXECUTE FUNCTION app.enforce_organization_type_immutability();

CREATE OR REPLACE FUNCTION app.enforce_membership_role_organization_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_type app."OrganizationType";
BEGIN
    SELECT o."type" INTO v_org_type
    FROM app."Organization" o
    WHERE o."id" = NEW."organizationId";

    IF v_org_type IS NULL THEN
        RAISE EXCEPTION 'Organization % not found', NEW."organizationId" USING ERRCODE = '23503';
    END IF;

    IF NEW."role" = 'RECRUITER' AND v_org_type <> 'COMPANY' THEN
        RAISE EXCEPTION 'Role RECRUITER can only belong to COMPANY' USING ERRCODE = '23514';
    END IF;

    IF NEW."role" = 'TRAINING_MANAGER' AND v_org_type <> 'TRAINING_CENTER' THEN
        RAISE EXCEPTION 'Role TRAINING_MANAGER can only belong to TRAINING_CENTER' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER membership_role_organization_type_trigger
BEFORE INSERT OR UPDATE OF "role", "organizationId" ON app."OrganizationMembership"
FOR EACH ROW
EXECUTE FUNCTION app.enforce_membership_role_organization_type();

ALTER TABLE app."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."OrganizationMembership" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OrganizationMembership_select_active_actor"
ON app."OrganizationMembership"
FOR SELECT
TO equipo10_runtime
USING (
    "userId" = app.actor_user_id() AND "status" = 'ACTIVE'
);

CREATE POLICY "Organization_select_active_for_active_members"
ON app."Organization"
FOR SELECT
TO equipo10_runtime
USING (
    "active" = true
    AND EXISTS (
        SELECT 1
        FROM app."OrganizationMembership" m
        WHERE m."organizationId" = "Organization"."id"
          AND m."userId" = app.actor_user_id()
          AND m."status" = 'ACTIVE'
    )
);

REVOKE ALL ON TABLE app."Organization" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE app."OrganizationMembership" FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        GRANT SELECT ON TABLE app."Organization" TO equipo10_runtime;
        GRANT SELECT ON TABLE app."OrganizationMembership" TO equipo10_runtime;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.bootstrap_app_user(p_auth_subject uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
DECLARE
    v_user_id uuid;
    v_status app."UserStatus";
BEGIN
    IF p_auth_subject IS NULL THEN
        RAISE EXCEPTION 'Auth subject cannot be null' USING ERRCODE = '22004';
    END IF;

    INSERT INTO app."AppUser" ("id", "authSubject", "updatedAt")
    VALUES (pg_catalog.gen_random_uuid(), p_auth_subject, pg_catalog.clock_timestamp())
    ON CONFLICT ("authSubject") DO NOTHING;

    SELECT u."id", u."status" INTO v_user_id, v_status
    FROM app."AppUser" u
    WHERE u."authSubject" = p_auth_subject;

    IF v_status = 'DISABLED' THEN
        RAISE EXCEPTION 'User account is disabled' USING ERRCODE = '42501';
    END IF;

    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.resolve_app_user(p_auth_subject uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app
AS $$
DECLARE
    v_user_id uuid;
    v_status app."UserStatus";
BEGIN
    IF p_auth_subject IS NULL THEN
        RAISE EXCEPTION 'Auth subject cannot be null' USING ERRCODE = '22004';
    END IF;

    SELECT u."id", u."status" INTO v_user_id, v_status
    FROM app."AppUser" u
    WHERE u."authSubject" = p_auth_subject;

    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_status = 'DISABLED' THEN
        RAISE EXCEPTION 'User account is disabled' USING ERRCODE = '42501';
    END IF;

    RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.bootstrap_app_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app.resolve_app_user(uuid) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION app.enforce_organization_type_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION app.enforce_membership_role_organization_type() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_runtime') THEN
        REVOKE EXECUTE ON FUNCTION app.bootstrap_app_user(uuid) FROM equipo10_runtime;
        REVOKE EXECUTE ON FUNCTION app.resolve_app_user(uuid) FROM equipo10_runtime;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'equipo10_api') THEN
        GRANT USAGE ON SCHEMA app TO equipo10_api;
        GRANT EXECUTE ON FUNCTION app.bootstrap_app_user(uuid) TO equipo10_api;
        GRANT EXECUTE ON FUNCTION app.resolve_app_user(uuid) TO equipo10_api;
    END IF;
END;
$$;

COMMIT;
