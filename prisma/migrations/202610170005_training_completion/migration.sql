-- Centre completion is a separate declaration, never automatic skill accreditation.
CREATE TABLE app."TrainingCompletion" (
  id uuid PRIMARY KEY,
  "reservationId" uuid NOT NULL UNIQUE REFERENCES app."CourseReservation"(id) ON DELETE RESTRICT,
  "organizationId" uuid NOT NULL REFERENCES app."Organization"(id) ON DELETE RESTRICT,
  "actorUserId" uuid NOT NULL REFERENCES app."AppUser"(id) ON DELETE RESTRICT,
  decision varchar(20) NOT NULL CHECK (decision IN ('COMPLETED','NOT_COMPLETED')),
  "completedOn" date NOT NULL,
  reason varchar(1000) NOT NULL CHECK (length(trim(reason)) >= 3),
  revision integer NOT NULL DEFAULT 1 CHECK (revision = 1),
  "recordedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "TrainingCompletion_organization_recorded_idx" ON app."TrainingCompletion" ("organizationId","recordedAt");

-- Narrow projection avoids granting centres access to the full candidate profile/CV.
CREATE FUNCTION app.training_participants(org uuid, course_filter uuid DEFAULT NULL)
RETURNS TABLE(reservation_id uuid, reservation_number text, status text, course_id uuid,
  course_title text, edition_id uuid, participant_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT r.id,r."reservationNumber"::text,r.status::text,c.id,c.title::text,e.id,pv."displayName"::text
  FROM app."CourseReservation" r
  JOIN app."CourseEdition" e ON e.id=r."editionId"
  JOIN app."CourseVersion" v ON v.id=e."courseVersionId"
  JOIN app."Course" c ON c.id=v."courseId"
  JOIN app."CandidateProfile" p ON p.id=r."profileId"
  LEFT JOIN app."ProfileRevision" pv ON pv.id=p."currentVersionId"
  WHERE c."organizationId"=org AND app.can_manage_training_center(org)
    AND (course_filter IS NULL OR c.id=course_filter)
  ORDER BY r."createdAt" DESC,r.id LIMIT 200;
$$;
REVOKE ALL ON FUNCTION app.training_participants(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.training_participants(uuid,uuid) TO equipo10_runtime;

CREATE FUNCTION app.lock_training_reservation(org uuid, reservation uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE current_status text;
BEGIN
  IF NOT app.can_manage_training_center(org) THEN RETURN NULL; END IF;
  SELECT r.status::text INTO current_status FROM app."CourseReservation" r
    JOIN app."CourseEdition" e ON e.id=r."editionId"
    JOIN app."CourseVersion" v ON v.id=e."courseVersionId"
    JOIN app."Course" c ON c.id=v."courseId"
    WHERE r.id=reservation AND c."organizationId"=org FOR UPDATE OF r;
  RETURN current_status;
END $$;
REVOKE ALL ON FUNCTION app.lock_training_reservation(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lock_training_reservation(uuid,uuid) TO equipo10_runtime;

CREATE FUNCTION app.can_read_training_completion(reservation uuid, org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT app.can_manage_training_center(org) OR EXISTS (SELECT 1 FROM app."CourseReservation" r
    JOIN app."CandidateProfile" p ON p.id=r."profileId"
    WHERE r.id=reservation AND p."ownerUserId"=app.actor_user_id());
$$;
REVOKE ALL ON FUNCTION app.can_read_training_completion(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_read_training_completion(uuid,uuid) TO equipo10_runtime;

CREATE FUNCTION app.can_record_training_completion(reservation uuid, org uuid, completion_date date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT app.can_manage_training_center(org) AND completion_date <= CURRENT_DATE AND EXISTS (
    SELECT 1 FROM app."CourseReservation" r
    JOIN app."CourseEdition" e ON e.id=r."editionId"
    JOIN app."CourseVersion" v ON v.id=e."courseVersionId"
    JOIN app."Course" c ON c.id=v."courseId"
    WHERE r.id=reservation AND r.status='CONFIRMED' AND c."organizationId"=org
      AND completion_date >= e."startDate");
$$;
REVOKE ALL ON FUNCTION app.can_record_training_completion(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_record_training_completion(uuid,uuid,date) TO equipo10_runtime;

ALTER TABLE app."TrainingCompletion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingCompletion" FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON app."TrainingCompletion" TO equipo10_runtime;
CREATE POLICY training_completion_select ON app."TrainingCompletion" FOR SELECT TO equipo10_runtime
  USING (app.can_read_training_completion("reservationId","organizationId"));
CREATE POLICY training_completion_insert ON app."TrainingCompletion" FOR INSERT TO equipo10_runtime
  WITH CHECK ("actorUserId"=app.actor_user_id() AND
    app.can_record_training_completion("reservationId","organizationId","completedOn"));
-- No UPDATE/DELETE grants: corrections need an explicit future history workflow.

-- History retains a human-readable course even if its public listing is later hidden.
CREATE FUNCTION app.own_training_completions()
RETURNS TABLE(id uuid,"reservationId" uuid,"organizationId" uuid,decision varchar,
  "completedOn" date,reason varchar,revision integer,"recordedAt" timestamptz,
  course_title text,reservation_number text,edition_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT completion.id,completion."reservationId",completion."organizationId",completion.decision,
    completion."completedOn",completion.reason,completion.revision,completion."recordedAt",
    course.title::text,reservation."reservationNumber"::text,edition.id
  FROM app."TrainingCompletion" completion
  JOIN app."CourseReservation" reservation ON reservation.id=completion."reservationId"
  JOIN app."CandidateProfile" profile ON profile.id=reservation."profileId"
  JOIN app."CourseEdition" edition ON edition.id=reservation."editionId"
  JOIN app."CourseVersion" version ON version.id=edition."courseVersionId"
  JOIN app."Course" course ON course.id=version."courseId"
  WHERE profile."ownerUserId"=app.actor_user_id()
  ORDER BY completion."recordedAt" DESC,completion.id LIMIT 200;
$$;
REVOKE ALL ON FUNCTION app.own_training_completions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.own_training_completions() TO equipo10_runtime;
