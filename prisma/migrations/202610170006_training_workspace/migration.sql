CREATE TABLE app."TrainingCourseWorkspace" (
  "courseId" uuid PRIMARY KEY REFERENCES app."Course"(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app."TrainingCourseWorkspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."TrainingCourseWorkspace" FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON app."TrainingCourseWorkspace" TO equipo10_runtime;
CREATE POLICY workspace_read ON app."TrainingCourseWorkspace" FOR SELECT TO equipo10_runtime
USING (EXISTS(SELECT 1 FROM app."Course" c WHERE c.id="courseId" AND app.can_manage_training_center(c."organizationId")));
CREATE POLICY workspace_insert ON app."TrainingCourseWorkspace" FOR INSERT TO equipo10_runtime
WITH CHECK (EXISTS(SELECT 1 FROM app."Course" c WHERE c.id="courseId" AND NOT c.active AND app.can_manage_training_center(c."organizationId")));
CREATE POLICY workspace_update ON app."TrainingCourseWorkspace" FOR UPDATE TO equipo10_runtime
USING (EXISTS(SELECT 1 FROM app."Course" c WHERE c.id="courseId" AND NOT c.active AND app.can_manage_training_center(c."organizationId")))
WITH CHECK (EXISTS(SELECT 1 FROM app."Course" c WHERE c.id="courseId" AND NOT c.active AND app.can_manage_training_center(c."organizationId")));
