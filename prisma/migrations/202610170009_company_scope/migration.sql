-- Incremental correction: never rewrite the already deployed migration003.
CREATE FUNCTION app.can_manage_company(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT EXISTS(SELECT 1 FROM app."OrganizationMembership" m JOIN app."Organization" o ON o.id=m."organizationId"
 WHERE m."userId"=app.actor_user_id() AND m."organizationId"=target AND m.status='ACTIVE'
 AND m.role IN ('ADMIN','RECRUITER') AND o.type='COMPANY' AND o.active);
$$;
REVOKE ALL ON FUNCTION app.can_manage_company(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.can_manage_company(uuid) TO equipo10_runtime;

DROP POLICY "Opportunity_insert_employer" ON app."Opportunity";
CREATE POLICY "Opportunity_insert_employer" ON app."Opportunity" FOR INSERT TO equipo10_runtime WITH CHECK(app.can_manage_company("organizationId"));
DROP POLICY "Opportunity_update_employer" ON app."Opportunity";
CREATE POLICY "Opportunity_update_employer" ON app."Opportunity" FOR UPDATE TO equipo10_runtime USING(app.can_manage_company("organizationId")) WITH CHECK(app.can_manage_company("organizationId"));

DROP POLICY "OpportunityRequirement_insert_employer" ON app."OpportunityRequirement";
CREATE POLICY "OpportunityRequirement_insert_employer" ON app."OpportunityRequirement" FOR INSERT TO equipo10_runtime
WITH CHECK(EXISTS(SELECT 1 FROM app."Opportunity" o WHERE o.id="opportunityId" AND app.can_manage_company(o."organizationId")));
DROP POLICY "OpportunityRequirement_update_employer" ON app."OpportunityRequirement";
CREATE POLICY "OpportunityRequirement_update_employer" ON app."OpportunityRequirement" FOR UPDATE TO equipo10_runtime
USING(EXISTS(SELECT 1 FROM app."Opportunity" o WHERE o.id="opportunityId" AND app.can_manage_company(o."organizationId")))
WITH CHECK(EXISTS(SELECT 1 FROM app."Opportunity" o WHERE o.id="opportunityId" AND app.can_manage_company(o."organizationId")));

DROP POLICY "OpportunityDraft_select_employer" ON app."OpportunityDraft";
CREATE POLICY "OpportunityDraft_select_employer" ON app."OpportunityDraft" FOR SELECT TO equipo10_runtime USING(app.can_manage_company("organizationId"));
DROP POLICY "OpportunityDraft_insert_employer" ON app."OpportunityDraft";
CREATE POLICY "OpportunityDraft_insert_employer" ON app."OpportunityDraft" FOR INSERT TO equipo10_runtime WITH CHECK(app.can_manage_company("organizationId") AND "authorUserId"=app.actor_user_id());
DROP POLICY "OpportunityDraft_update_employer" ON app."OpportunityDraft";
CREATE POLICY "OpportunityDraft_update_employer" ON app."OpportunityDraft" FOR UPDATE TO equipo10_runtime USING(app.can_manage_company("organizationId")) WITH CHECK(app.can_manage_company("organizationId"));

DROP POLICY "CandidateApplication_select_employer" ON app."CandidateApplication";
CREATE POLICY "CandidateApplication_select_employer" ON app."CandidateApplication" FOR SELECT TO equipo10_runtime
USING(status='ACTIVE' AND EXISTS(SELECT 1 FROM app."Opportunity" o WHERE o.id="opportunityId" AND app.can_manage_company(o."organizationId")));

CREATE FUNCTION app.company_has_consented_revision(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app AS $$
 SELECT EXISTS(SELECT 1 FROM app."CandidateApplication" a JOIN app."Opportunity" o ON o.id=a."opportunityId"
 WHERE a."profileRevisionId"=target AND a.status='ACTIVE' AND app.can_manage_company(o."organizationId"));
$$;
REVOKE ALL ON FUNCTION app.company_has_consented_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.company_has_consented_revision(uuid) TO equipo10_runtime;
DROP POLICY "profile_revision_consented_employer" ON app."ProfileRevision";
CREATE POLICY "profile_revision_consented_employer" ON app."ProfileRevision" FOR SELECT TO equipo10_runtime USING(app.company_has_consented_revision(id));
DROP POLICY "competency_claim_consented_employer" ON app."CompetencyClaim";
CREATE POLICY "competency_claim_consented_employer" ON app."CompetencyClaim" FOR SELECT TO equipo10_runtime USING(app.company_has_consented_revision("revisionId"));
DROP POLICY "evidence_link_consented_employer" ON app."ProfileEvidenceLink";
CREATE POLICY "evidence_link_consented_employer" ON app."ProfileEvidenceLink" FOR SELECT TO equipo10_runtime USING(app.company_has_consented_revision("revisionId"));
DROP POLICY "profile_evidence_consented_employer" ON app."ProfileEvidence";
CREATE POLICY "profile_evidence_consented_employer" ON app."ProfileEvidence" FOR SELECT TO equipo10_runtime
USING(EXISTS(SELECT 1 FROM app."ProfileEvidenceLink" l WHERE l."evidenceId"="ProfileEvidence".id AND app.company_has_consented_revision(l."revisionId")));

-- C01 reads the actual consented logistics; without these policies a company
-- silently sees missing constraints even when the candidate confirmed them.
CREATE POLICY "constraints_consented_employer" ON app."ProfileConstraints" FOR SELECT TO equipo10_runtime
USING(app.company_has_consented_revision("revisionId"));
CREATE POLICY "availability_consented_employer" ON app."AvailabilityWindow" FOR SELECT TO equipo10_runtime
USING(app.company_has_consented_revision("revisionId"));
