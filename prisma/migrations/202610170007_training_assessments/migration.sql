CREATE TABLE app."TrainingAssessmentBank" (
 id uuid PRIMARY KEY, "courseVersionId" uuid NOT NULL REFERENCES app."CourseVersion"(id),
 "createdBy" uuid NOT NULL REFERENCES app."AppUser"(id), snapshot jsonb NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app."TrainingAssessmentAttempt" (
 id uuid PRIMARY KEY, "bankId" uuid NOT NULL REFERENCES app."TrainingAssessmentBank"(id),
 "profileId" uuid NOT NULL REFERENCES app."CandidateProfile"(id), snapshot jsonb NOT NULL,
 answers jsonb, result jsonb, "createdAt" timestamptz NOT NULL DEFAULT now(), "submittedAt" timestamptz,
 CHECK ((answers IS NULL AND result IS NULL AND "submittedAt" IS NULL) OR (answers IS NOT NULL AND result IS NOT NULL AND "submittedAt" IS NOT NULL))
);
CREATE TABLE app."TrainingAssessmentAssociation" (
 id uuid PRIMARY KEY, "attemptId" uuid NOT NULL UNIQUE REFERENCES app."TrainingAssessmentAttempt"(id),
 "profileId" uuid NOT NULL REFERENCES app."CandidateProfile"(id), snapshot jsonb NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app."TrainingAssessmentBank"("courseVersionId","createdAt",id);
CREATE INDEX ON app."TrainingAssessmentAttempt"("profileId","createdAt");
ALTER TABLE app."TrainingAssessmentBank" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingAssessmentAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingAssessmentAssociation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingAssessmentBank" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingAssessmentAttempt" FORCE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingAssessmentAssociation" FORCE ROW LEVEL SECURITY;
CREATE POLICY assessment_bank_center ON app."TrainingAssessmentBank" FOR SELECT TO equipo10_runtime
USING(EXISTS(SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId" WHERE v.id="courseVersionId" AND app.can_manage_training_center(c."organizationId")));
CREATE POLICY assessment_bank_insert ON app."TrainingAssessmentBank" FOR INSERT TO equipo10_runtime
WITH CHECK("createdBy"=app.actor_user_id() AND EXISTS(SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId" WHERE v.id="courseVersionId" AND c.active AND app.can_manage_training_center(c."organizationId")));
CREATE POLICY assessment_attempt_own ON app."TrainingAssessmentAttempt" FOR SELECT TO equipo10_runtime
USING(app.is_candidate_profile_owner("profileId"));
CREATE POLICY assessment_attempt_submit ON app."TrainingAssessmentAttempt" FOR UPDATE TO equipo10_runtime
USING(app.is_candidate_profile_owner("profileId") AND "submittedAt" IS NULL)
WITH CHECK(app.is_candidate_profile_owner("profileId"));
CREATE POLICY assessment_association_own ON app."TrainingAssessmentAssociation" FOR SELECT TO equipo10_runtime
USING(app.is_candidate_profile_owner("profileId"));
CREATE POLICY assessment_association_insert ON app."TrainingAssessmentAssociation" FOR INSERT TO equipo10_runtime
WITH CHECK(app.is_candidate_profile_owner("profileId") AND EXISTS(SELECT 1 FROM app."TrainingAssessmentAttempt" a WHERE a.id="attemptId" AND a."profileId"="TrainingAssessmentAssociation"."profileId" AND a."submittedAt" IS NOT NULL));

-- Public metadata only; private bank answers never leave the server through a candidate DTO.
CREATE FUNCTION app.training_assessment_bank_metadata(target uuid)
RETURNS TABLE(id uuid,"courseVersionId" uuid,"questionCount" int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT b.id,b."courseVersionId",jsonb_array_length(b.snapshot->'questions')
 FROM app."TrainingAssessmentBank" b JOIN app."CourseVersion" v ON v.id=b."courseVersionId"
 JOIN app."Course" c ON c.id=v."courseId"
 WHERE c.id=target AND c.active AND app.actor_user_id() IS NOT NULL
 AND v.id=(SELECT v2.id FROM app."CourseVersion" v2 WHERE v2."courseId"=target ORDER BY v2."versionNumber" DESC LIMIT 1)
 ORDER BY b."createdAt" DESC,b.id DESC LIMIT 1;
$$;
CREATE FUNCTION app.start_training_assessment(target uuid,target_bank uuid,attempt uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app AS $$
DECLARE profile uuid; payload jsonb; current_bank uuid;
BEGIN
 SELECT p.id INTO profile FROM app."CandidateProfile" p WHERE p."ownerUserId"=app.actor_user_id();
 IF profile IS NULL THEN RAISE EXCEPTION 'assessment_profile_required'; END IF;
 SELECT m.id INTO current_bank FROM app.training_assessment_bank_metadata(target) m;
 IF current_bank IS NULL OR current_bank<>target_bank THEN RAISE EXCEPTION 'assessment_bank_outdated'; END IF;
 SELECT b.snapshot INTO payload FROM app."TrainingAssessmentBank" b WHERE b.id=target_bank;
 INSERT INTO app."TrainingAssessmentAttempt"(id,"bankId","profileId",snapshot) VALUES(attempt,target_bank,profile,payload);
 RETURN attempt;
END;
$$;
CREATE FUNCTION app.guard_training_assessment_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME IN ('TrainingAssessmentBank','TrainingAssessmentAssociation') THEN RAISE EXCEPTION 'assessment_snapshot_immutable'; END IF;
 IF NEW.id<>OLD.id OR NEW."bankId"<>OLD."bankId" OR NEW."profileId"<>OLD."profileId" OR NEW.snapshot<>OLD.snapshot OR NEW."createdAt"<>OLD."createdAt" OR OLD."submittedAt" IS NOT NULL THEN RAISE EXCEPTION 'assessment_snapshot_immutable'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_assessment_bank BEFORE UPDATE OR DELETE ON app."TrainingAssessmentBank" FOR EACH ROW EXECUTE FUNCTION app.guard_training_assessment_snapshot();
CREATE TRIGGER immutable_assessment_association BEFORE UPDATE OR DELETE ON app."TrainingAssessmentAssociation" FOR EACH ROW EXECUTE FUNCTION app.guard_training_assessment_snapshot();
CREATE TRIGGER immutable_assessment_attempt BEFORE UPDATE ON app."TrainingAssessmentAttempt" FOR EACH ROW EXECUTE FUNCTION app.guard_training_assessment_snapshot();
REVOKE ALL ON app."TrainingAssessmentBank",app."TrainingAssessmentAttempt",app."TrainingAssessmentAssociation" FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON app."TrainingAssessmentBank",app."TrainingAssessmentAssociation" TO equipo10_runtime;
GRANT SELECT,UPDATE ON app."TrainingAssessmentAttempt" TO equipo10_runtime;
REVOKE ALL ON FUNCTION app.training_assessment_bank_metadata(uuid),app.start_training_assessment(uuid,uuid,uuid),app.guard_training_assessment_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.training_assessment_bank_metadata(uuid),app.start_training_assessment(uuid,uuid,uuid) TO equipo10_runtime;

-- The generic operation-receipt endpoint also reads this table. Revocation must
-- protect private answer keys there, not just inside the center controller.
CREATE POLICY assessment_bank_receipt_current_membership ON app."OperationReceipt"
AS RESTRICTIVE FOR SELECT TO equipo10_runtime
USING (
 operation<>'TRAINING_ASSESSMENT_BANK' OR EXISTS (
  SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId"
  WHERE v.id::text=("OperationReceipt"."receiptPayload"->>'course_version_id')
   AND app.can_manage_training_center(c."organizationId")
 )
);
