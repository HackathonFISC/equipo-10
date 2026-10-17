-- Existing D4 content tables, with ownership for center authoring; no new content model.
-- Definer reads only memberships/org, avoiding recursive public Course -> Organization RLS.
CREATE OR REPLACE FUNCTION app.can_manage_training_center(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, app AS $$
  SELECT EXISTS (
    SELECT 1 FROM app."OrganizationMembership" m JOIN app."Organization" o ON o.id=m."organizationId"
    WHERE m."organizationId"=target AND m."userId"=app.actor_user_id()
      AND m.status='ACTIVE' AND m.role IN ('TRAINING_MANAGER','ADMIN')
      AND o.active=true AND o.type='TRAINING_CENTER'
  );
$$;
REVOKE ALL ON FUNCTION app.can_manage_training_center(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_manage_training_center(uuid) TO equipo10_runtime;

CREATE POLICY "Course_select_center" ON app."Course" FOR SELECT TO equipo10_runtime
USING (app.can_manage_training_center("organizationId"));
CREATE POLICY "Course_insert_center" ON app."Course" FOR INSERT TO equipo10_runtime
WITH CHECK (app.can_manage_training_center("organizationId") AND active=false);
CREATE POLICY "Course_update_center" ON app."Course" FOR UPDATE TO equipo10_runtime
USING (app.can_manage_training_center("organizationId"))
WITH CHECK (app.can_manage_training_center("organizationId"));

DROP POLICY IF EXISTS "CourseVersion_select_all" ON app."CourseVersion";
CREATE POLICY "CourseVersion_select_visible" ON app."CourseVersion" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."Course" c WHERE c.id="courseId" AND (c.active OR app.can_manage_training_center(c."organizationId"))));
CREATE POLICY "CourseVersion_insert_center" ON app."CourseVersion" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."Course" c WHERE c.id="courseId" AND app.can_manage_training_center(c."organizationId") AND NOT c.active));

DROP POLICY IF EXISTS "CourseLearningOutcome_select_all" ON app."CourseLearningOutcome";
CREATE POLICY "CourseLearningOutcome_select_visible" ON app."CourseLearningOutcome" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CourseVersion" v WHERE v.id="courseVersionId"));
CREATE POLICY "CourseLearningOutcome_insert_center" ON app."CourseLearningOutcome" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId" WHERE v.id="courseVersionId" AND app.can_manage_training_center(c."organizationId") AND NOT c.active));

DROP POLICY IF EXISTS "CoursePrerequisite_select_all" ON app."CoursePrerequisite";
CREATE POLICY "CoursePrerequisite_select_visible" ON app."CoursePrerequisite" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CourseVersion" v WHERE v.id="courseVersionId"));
CREATE POLICY "CoursePrerequisite_insert_center" ON app."CoursePrerequisite" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId" WHERE v.id="courseVersionId" AND app.can_manage_training_center(c."organizationId") AND NOT c.active));

DROP POLICY IF EXISTS "CourseEdition_select_active" ON app."CourseEdition";
CREATE POLICY "CourseEdition_select_visible" ON app."CourseEdition" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId" WHERE v.id="courseVersionId" AND (("CourseEdition".active AND c.active) OR app.can_manage_training_center(c."organizationId"))));
CREATE POLICY "CourseEdition_insert_center" ON app."CourseEdition" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."CourseVersion" v JOIN app."Course" c ON c.id=v."courseId" WHERE v.id="courseVersionId" AND app.can_manage_training_center(c."organizationId") AND NOT c.active));

DROP POLICY IF EXISTS "CourseSession_select_all" ON app."CourseSession";
CREATE POLICY "CourseSession_select_visible" ON app."CourseSession" FOR SELECT TO equipo10_runtime
USING (EXISTS (SELECT 1 FROM app."CourseEdition" e WHERE e.id="editionId"));
CREATE POLICY "CourseSession_insert_center" ON app."CourseSession" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS (SELECT 1 FROM app."CourseEdition" e JOIN app."CourseVersion" v ON v.id=e."courseVersionId" JOIN app."Course" c ON c.id=v."courseId" WHERE e.id="editionId" AND app.can_manage_training_center(c."organizationId") AND NOT c.active));

GRANT SELECT, INSERT, UPDATE ON app."Course" TO equipo10_runtime;
GRANT SELECT, INSERT ON app."CourseVersion", app."CourseLearningOutcome", app."CoursePrerequisite", app."CourseEdition", app."CourseSession" TO equipo10_runtime;
-- Existing D4 slot-update policy remains; reservation/cancellation retains its original path.
