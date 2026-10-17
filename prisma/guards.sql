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
