import {beforeAll,afterAll,describe,it,expect} from "bun:test";
import {randomUUID} from "node:crypto";
import {setupTestDatabase} from "../support/training-center-database-fixture";
import {TrainingAssessmentsService} from "../../apps/api/src/modules/training-assessments/training-assessments.service";
import {AssessmentBankConfirmationSchema,AssessmentSubmissionSchema,type AssessmentBank,type AssessmentQuestion} from "../../packages/contracts/src/training-assessments";
import type {AssessmentRunner} from "../../apps/api/src/modules/training-assessments/assessment-agent.service";
import {seedConfirmedD7Profile} from "../support/d7-confirmed-profile";
import {ProfileService} from "../../apps/api/src/modules/profile/profile.service";
async function rejects(promise:Promise<unknown>,code:string){let caught:any;try{await promise;}catch(e){caught=e;}expect(caught?.code).toBe(code);}
describe("D7-C reviewed objective bank, private attempts and immutable snapshots",()=>{
 let fixture:Awaited<ReturnType<typeof setupTestDatabase>>,service:TrainingAssessmentsService;
 const manager=randomUUID(),candidate=randomUUID(),other=randomUUID(),managerAuth=randomUUID(),candidateAuth=randomUUID(),otherAuth=randomUUID(),profile=randomUUID(),otherProfile=randomUUID();
 const org=randomUUID(),course=randomUUID(),catalog=randomUUID(),competency=randomUUID(),version=randomUUID();
 const centerIdentity={id:managerAuth,email:"center@example.test"},identity={id:candidateAuth,email:"young@example.test"},otherIdentity={id:otherAuth,email:"other@example.test"};
 const syllabus="El inventario registra entradas y salidas. Una entrada aumenta las existencias.";
 const qid=randomUUID(),correct=randomUUID(),wrong=randomUUID();
 const question:AssessmentQuestion={id:qid,prompt:"¿Qué ocurre al registrar una entrada?",options:[{id:correct,text:"Aumentan las existencias"},{id:wrong,text:"Se eliminan todas las existencias"}],correct_option_id:correct,rationale:"Una entrada aumenta las existencias.",quote:"Una entrada aumenta las existencias.",competency_id:competency};
 const runner:AssessmentRunner=async s=>({course_version_id:s.course_version_id,catalog_version_id:s.catalog_version_id,questions:[question]});
 const confirmation=()=>({confirm:true as const,course_version_id:version,questions:[question]});
 async function bank(){return service.confirmBank(centerIdentity,org,course,confirmation(),randomUUID());}
 async function attempt(){const b=await bank();return service.start(identity,course,{bank_id:b.id,consent:true},randomUUID());}
 beforeAll(async()=>{
  fixture=await setupTestDatabase();service=new TrainingAssessmentsService(fixture.db,runner);
  for(const [id,auth] of [[manager,managerAuth],[candidate,candidateAuth],[other,otherAuth]])await fixture.admin.query('INSERT INTO app."AppUser"(id,"authSubject","updatedAt") VALUES($1,$2,NOW())',[id,auth]);
  for(const [id,user] of [[profile,candidate],[otherProfile,other]])await fixture.admin.query('INSERT INTO app."CandidateProfile"(id,"ownerUserId") VALUES($1,$2)',[id,user]);
  await fixture.admin.query('INSERT INTO app."Organization"(id,name,type,"updatedAt") VALUES($1,\'Centro DEMO\',\'TRAINING_CENTER\',NOW())',[org]);
  await fixture.admin.query('INSERT INTO app."OrganizationMembership"(id,"userId","organizationId",role,"updatedAt") VALUES($1,$2,$3,\'TRAINING_MANAGER\',NOW())',[randomUUID(),manager,org]);
  await fixture.admin.query('INSERT INTO app."CatalogVersion"(id,code,"sourceLabel") VALUES($1,\'D7C-DEMO\',\'Synthetic\')',[catalog]);
  await fixture.admin.query('INSERT INTO app."CompetencyEntry"(id,"catalogVersionId",code,name,description,kind) VALUES($1,$2,\'INV\',\'Inventario\',\'Inventario\',\'SKILL\')',[competency,catalog]);
  await fixture.admin.query('INSERT INTO app."Course"(id,"organizationId",code,title,description,"updatedAt") VALUES($1,$2,\'D7C-COURSE\',\'Inventario DEMO\',\'Curso\',NOW())',[course,org]);
  await fixture.admin.query('INSERT INTO app."CourseVersion"(id,"courseId","catalogVersionId","syllabusText") VALUES($1,$2,$3,$4)',[version,course,catalog,syllabus]);
  await fixture.admin.query('INSERT INTO app."CourseLearningOutcome"(id,"courseVersionId","competencyId","catalogVersionId",description) VALUES($1,$2,$3,$4,\'Registrar entradas\')',[randomUUID(),version,competency,catalog]);
 },30000);
 afterAll(async()=>{await fixture?.close();});
 it("denies candidates access to center bank",async()=>{await rejects(service.banks(identity,org,course),"TRAINING_CENTER_NOT_FOUND");});
 it("requires explicit source-analysis consent",async()=>{await rejects(service.propose(centerIdentity,org,course,false),"CONSENT_REQUIRED");});
 it("requires a published confirmed map",async()=>{await rejects(service.propose(centerIdentity,org,randomUUID(),true),"CONFIRMED_MAP_REQUIRED");});
 it("passes exact map to A02 and validates source references",async()=>{const p=await service.propose(centerIdentity,org,course,true);expect(p.questions[0].quote).toBe(question.quote);expect(p.course_version_id).toBe(version);});
 it("rejects hallucinated quotes and wrong mapped competency",async()=>{
  const bad=new TrainingAssessmentsService(fixture.db,async s=>({course_version_id:s.course_version_id,catalog_version_id:s.catalog_version_id,questions:[{...question,quote:"No existe"}]}));
  await rejects(bad.propose(centerIdentity,org,course,true),"INVALID_ASSESSMENT_BANK");
  await rejects(service.confirmBank(centerIdentity,org,course,{...confirmation(),questions:[{...question,competency_id:randomUUID()}]},randomUUID()),"INVALID_ASSESSMENT_SOURCE");
 });
 it("rejects stale map and malformed rubric without saving bank",async()=>{
  await rejects(service.confirmBank(centerIdentity,org,course,{...confirmation(),course_version_id:randomUUID()},randomUUID()),"ASSESSMENT_VERSION_OUTDATED");
  expect(AssessmentBankConfirmationSchema.safeParse({...confirmation(),questions:[{...question,correct_option_id:randomUUID()}]}).success).toBe(false);
 });
 it("confirms bank idempotently and preserves private source snapshot",async()=>{
  const key=randomUUID(),a=await service.confirmBank(centerIdentity,org,course,confirmation(),key),b=await service.confirmBank(centerIdentity,org,course,confirmation(),key);
  expect(a.id).toBe(b.id);expect(a.questions[0].rationale).toBe(question.rationale);
  const stored=(await fixture.admin.query('SELECT snapshot FROM app."TrainingAssessmentBank" WHERE id=$1',[a.id])).rows[0].snapshot;
  expect(stored.source_snapshot.syllabus_text).toBe(syllabus);
 });
 it("revalidates membership before replaying a secret bank receipt",async()=>{
  const key=randomUUID();await service.confirmBank(centerIdentity,org,course,confirmation(),key);
  await fixture.admin.query('UPDATE app."OrganizationMembership" SET status=\'REVOKED\' WHERE "userId"=$1',[manager]);
  await rejects(service.confirmBank(centerIdentity,org,course,confirmation(),key),"TRAINING_CENTER_NOT_FOUND");
  await fixture.admin.query('UPDATE app."OrganizationMembership" SET status=\'ACTIVE\' WHERE "userId"=$1',[manager]);
 });
 it("blocks revoked-center answer keys through the generic profile receipt endpoint",async()=>{
  const key=randomUUID();await service.confirmBank(centerIdentity,org,course,confirmation(),key);
  const receipt=(await fixture.admin.query('SELECT id FROM app."OperationReceipt" WHERE "actorUserId"=$1 AND operation=\'TRAINING_ASSESSMENT_BANK\' AND "idempotencyKey"=$2',[manager,key])).rows[0].id;
  const profiles=new ProfileService(fixture.db);
  await profiles.getOperationReceipt(centerIdentity,receipt);
  await fixture.admin.query('UPDATE app."OrganizationMembership" SET status=\'REVOKED\' WHERE "userId"=$1',[manager]);
  try{let caught:any;try{await profiles.getOperationReceipt(centerIdentity,receipt);}catch(e){caught=e;}expect(caught?.status).toBe(404);}
  finally{await fixture.admin.query('UPDATE app."OrganizationMembership" SET status=\'ACTIVE\' WHERE "userId"=$1',[manager]);}
 });
 it("requires attempt consent and rejects superseded bank for new starts",async()=>{
  const old=await bank();await bank();
  await rejects(service.start(identity,course,{bank_id:old.id,consent:false as true},randomUUID()),"CONSENT_REQUIRED");
  await rejects(service.start(identity,course,{bank_id:old.id,consent:true},randomUUID()),"ASSESSMENT_BANK_OUTDATED");
 });
 it("starts once without revealing answer keys or rationale",async()=>{
  const b=await bank(),key=randomUUID();const a=await service.start(identity,course,{bank_id:b.id,consent:true},key),r=await service.start(identity,course,{bank_id:b.id,consent:true},key);
  expect(a.id).toBe(r.id);expect(a.result).toBeNull();
  const json=JSON.stringify(a);for(const privateKey of ["correct_option_id","rationale","source_snapshot","competency_id"])expect(json.includes(privateKey)).toBe(false);
 });
 it("candidate and center cannot read somebody else's private attempt",async()=>{
  const a=await attempt();await rejects(service.getAttempt(otherIdentity,a.id),"ASSESSMENT_ATTEMPT_NOT_FOUND");await rejects(service.getAttempt(centerIdentity,a.id),"ASSESSMENT_ATTEMPT_NOT_FOUND");
  expect((await service.listAttempts(otherIdentity,course)).items).toHaveLength(0);
 });
 it("validates full unique answers before deterministic marking",async()=>{
  const a=await attempt();expect(AssessmentSubmissionSchema.safeParse({confirm:true,answers:[{question_id:qid,option_id:correct},{question_id:qid,option_id:wrong}]}).success).toBe(false);
  await rejects(service.submit(identity,a.id,{confirm:true,answers:[{question_id:qid,option_id:randomUUID()}]},randomUUID()),"ASSESSMENT_ANSWERS_INVALID");
  expect((await service.getAttempt(identity,a.id)).status).toBe("STARTED");
 });
 it("marks correct and wrong choices without AI or invented percentages",async()=>{
  for(const [choice,count] of [[correct,1],[wrong,0]] as const){const a=await attempt();const result=await service.submit(identity,a.id,{confirm:true,answers:[{question_id:qid,option_id:choice}]},randomUUID());expect(result.result?.correct_count).toBe(count);expect(result.result?.total_count).toBe(1);expect(result.result?.scope).toBe("EXERCISE_ONLY");expect(JSON.stringify(result.result).includes("percentage")).toBe(false);}
 });
 it("submitted attempt replays once and does not recalculate on new bank",async()=>{
  const a=await attempt(),key=randomUUID(),body={confirm:true as const,answers:[{question_id:qid,option_id:correct}]};
  const result=await service.submit(identity,a.id,body,key);await bank();
  expect((await service.submit(identity,a.id,body,key)).result).toEqual(result.result);
  expect((await service.getAttempt(identity,a.id)).result).toEqual(result.result);
  await rejects(service.submit(identity,a.id,body,randomUUID()),"ASSESSMENT_ALREADY_SUBMITTED");
 });
 it("started attempt retains original key after bank revision",async()=>{
  const a=await attempt();await service.confirmBank(centerIdentity,org,course,{...confirmation(),questions:[{...question,correct_option_id:wrong,rationale:"Nueva rúbrica revisada"}]},randomUUID());
  expect((await service.submit(identity,a.id,{confirm:true,answers:[{question_id:qid,option_id:correct}]},randomUUID())).result?.correct_count).toBe(1);
 });
 it("association requires human confirmation, submitted result and confirmed profile",async()=>{
  const a=await attempt();await rejects(service.associate(identity,a.id,false,randomUUID()),"CONFIRMATION_REQUIRED");await rejects(service.associate(identity,a.id,true,randomUUID()),"ASSESSMENT_NOT_SUBMITTED");
  await service.submit(identity,a.id,{confirm:true,answers:[{question_id:qid,option_id:correct}]},randomUUID());
  await rejects(service.associate(identity,a.id,true,randomUUID()),"CONFIRMED_PROFILE_REQUIRED");
  expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."CompetencyClaim" WHERE "profileId"=$1',[profile])).rows[0].n).toBe(0);
 });
 it("associates a limited immutable result to an explicitly confirmed profile version",async()=>{
  const confirmed=await seedConfirmedD7Profile(fixture.db,identity);
  const a=await attempt();await service.submit(identity,a.id,{confirm:true,answers:[{question_id:qid,option_id:correct}]},randomUUID());
  const key=randomUUID(),saved=await service.associate(identity,a.id,true,key),replay=await service.associate(identity,a.id,true,key);
  expect(saved.association_id).toBe(replay.association_id);
  expect((await service.getAttempt(identity,a.id)).association_confirmed).toBe(true);
  const stored=(await fixture.admin.query('SELECT snapshot FROM app."TrainingAssessmentAssociation" WHERE id=$1',[saved.association_id])).rows[0].snapshot;
  expect(stored.profile_version_id).toBe(confirmed.current_version_id);
  expect(stored.does_not_accredit_competency).toBe(true);
  expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."CompetencyClaim" WHERE "profileId"=$1',[profile])).rows[0].n).toBe(0);
 },15000);
});
