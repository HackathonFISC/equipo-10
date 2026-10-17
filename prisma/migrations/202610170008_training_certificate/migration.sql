CREATE TABLE app."TrainingCertificate" (
  id uuid PRIMARY KEY,
  "completionId" uuid NOT NULL UNIQUE REFERENCES app."TrainingCompletion"(id) ON DELETE RESTRICT,
  "organizationId" uuid NOT NULL REFERENCES app."Organization"(id) ON DELETE RESTRICT,
  "actorUserId" uuid NOT NULL REFERENCES app."AppUser"(id) ON DELETE RESTRICT,
  "originalFilename" varchar(160) NOT NULL,
  "contentType" varchar(40) NOT NULL CHECK ("contentType"='application/pdf'),
  "sizeBytes" integer NOT NULL CHECK ("sizeBytes">0 AND "sizeBytes"<=5242880),
  sha256 varchar(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  "recordedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION app.can_read_training_certificate(completion uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT EXISTS (SELECT 1 FROM app."TrainingCompletion" c WHERE c.id=completion
   AND app.can_read_training_completion(c."reservationId",c."organizationId"));
$$;
REVOKE ALL ON FUNCTION app.can_read_training_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_read_training_certificate(uuid) TO equipo10_runtime;
CREATE FUNCTION app.can_attach_training_certificate(completion uuid,org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT app.can_manage_training_center(org) AND EXISTS(SELECT 1 FROM app."TrainingCompletion" c
   WHERE c.id=completion AND c."organizationId"=org AND c.decision='COMPLETED');
$$;
REVOKE ALL ON FUNCTION app.can_attach_training_certificate(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_attach_training_certificate(uuid,uuid) TO equipo10_runtime;
ALTER TABLE app."TrainingCertificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingCertificate" FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON app."TrainingCertificate" TO equipo10_runtime;
CREATE POLICY training_certificate_read ON app."TrainingCertificate" FOR SELECT TO equipo10_runtime
 USING(app.can_read_training_certificate("completionId"));
CREATE POLICY training_certificate_insert ON app."TrainingCertificate" FOR INSERT TO equipo10_runtime
 WITH CHECK("actorUserId"=app.actor_user_id() AND app.can_attach_training_certificate("completionId","organizationId"));
