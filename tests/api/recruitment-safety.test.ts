import {beforeAll,afterAll,describe,it,expect} from "bun:test";
import {randomUUID} from "node:crypto";
import {setupTestDatabase} from "../support/training-center-database-fixture";
import {seedConfirmedD7Profile} from "../support/d7-confirmed-profile";
import {RecruitmentService} from "../../apps/api/src/modules/recruitment/recruitment.service";
import {AgentA01Service} from "../../apps/api/src/modules/recruitment/agent-a01.service";
import type {PublishOpportunityDraftRequest} from "@equipo10/contracts";
async function rejects(p:Promise<unknown>,code:string){let error:any;try{await p;}catch(e){error=e;}expect(error?.code).toBe(code);}
describe("Recruitment safety: semantic guards, fixed catalog and real C01",()=>{
 let f:Awaited<ReturnType<typeof setupTestDatabase>>,service:RecruitmentService;
 const user=randomUUID(),auth=randomUUID(),young=randomUUID(),youngAuth=randomUUID(),profile=randomUUID(),org=randomUUID(),center=randomUUID(),catalog=randomUUID(),occupation=randomUUID(),skill=randomUUID(),trainable=randomUUID();
 const identity={id:auth,email:"recruiter@example.test"},candidate={id:youngAuth,email:"candidate@example.test"};
 const analyzed:string[]=[];
 beforeAll(async()=>{
  f=await setupTestDatabase();
  for(const [id,subject] of [[user,auth],[young,youngAuth]])await f.admin.query('INSERT INTO app."AppUser"(id,"authSubject","updatedAt") VALUES($1,$2,NOW())',[id,subject]);
  await f.admin.query('INSERT INTO app."CandidateProfile"(id,"ownerUserId") VALUES($1,$2)',[profile,young]);
  for(const [id,type] of [[org,"COMPANY"],[center,"TRAINING_CENTER"]]){await f.admin.query('INSERT INTO app."Organization"(id,name,type,"updatedAt") VALUES($1,\'Demo\',$2::app."OrganizationType",NOW())',[id,type]);await f.admin.query('INSERT INTO app."OrganizationMembership"(id,"userId","organizationId",role,"updatedAt") VALUES($1,$2,$3,\'ADMIN\',NOW())',[randomUUID(),user,id]);}
  await f.admin.query('INSERT INTO app."CatalogVersion"(id,code,"sourceLabel") VALUES($1,\'SAFETY-1\',\'Synthetic\')',[catalog]);
  await f.admin.query('INSERT INTO app."OccupationEntry"(id,"catalogVersionId",code,name,description) VALUES($1,$2,\'INV\',\'Auxiliar\',\'Inventario\')',[occupation,catalog]);
  for(const id of [skill,trainable])await f.admin.query('INSERT INTO app."CompetencyEntry"(id,"catalogVersionId",code,name,description,kind) VALUES($1,$2,$3,\'Inventario\',\'Inventario\',\'SKILL\')',[id,catalog,id]);
  const a01=new AgentA01Service(f.db,async input=>{
   analyzed.push(input.rawText);
   const blocked=input.rawText.includes("Excluir barrios vulnerables");
   return {title:"Auxiliar",occupation_id:occupation,proposed_requirements:[{competency_id:skill,competency_name:"Inventario",requirement_type:"ESSENTIAL",stage:"ENTRY",description:"Inventario"}],clarification_questions:["¿Qué tarea concreta?"],discriminatory_warnings:blocked?[{field:"description",issue:"SEMANTIC_EXCLUSION",severity:"BLOCKING",explanation:"Exclusión por residencia"}]:[],has_blocking_issues:blocked,provider:"test"};
  });service=new RecruitmentService(f.db,a01);
 },30000);
 afterAll(async()=>{await f?.close();});
 const publish=(requirements:PublishOpportunityDraftRequest["requirements"]=[{competency_id:skill,requirement_type:"ESSENTIAL",stage:"ENTRY",description:"Inventario"}]):PublishOpportunityDraftRequest=>({title:"Auxiliar",occupation_id:occupation,location:"Panamá",workplace_type:"ON_SITE",requirements});
 it("requires an active company rather than any organization ADMIN",async()=>{
  await rejects(service.createDraft(identity,center,{raw_text:"Registrar inventario y preparar pedidos"}),"ORGANIZATION_ACCESS_DENIED");
  await f.admin.query('UPDATE app."Organization" SET active=false WHERE id=$1',[org]);
  try{await rejects(service.createDraft(identity,org,{raw_text:"Registrar inventario y preparar pedidos"}),"ORGANIZATION_ACCESS_DENIED");}finally{await f.admin.query('UPDATE app."Organization" SET active=true WHERE id=$1',[org]);}
 });
 it("does not clear semantic A01 warnings through an unrelated PATCH",async()=>{
  const d=await service.createDraft(identity,org,{raw_text:"Excluir barrios vulnerables; registrar inventario."});
  expect(d.has_blocking_issues).toBe(true);
  const changed=await service.updateDraft(identity,org,d.id,{location:"Panamá"});
  expect(changed.has_blocking_issues).toBe(true);
  await rejects(service.publishDraft(identity,org,d.id,publish()),"DISCRIMINATORY_TERMS_BLOCKED");
 });
 it("uses clarification answers in a real fresh analysis before updating",async()=>{
  const d=await service.createDraft(identity,org,{raw_text:"Registrar inventario y preparar pedidos"});
  const n=analyzed.length;
  await service.updateDraft(identity,org,d.id,{clarification_answers:[{question:"¿Qué tarea concreta?",answer:"Registrar entradas con respaldo"}]});
  expect(analyzed.length).toBe(n+1);expect(analyzed.at(-1)).toContain("Registrar entradas con respaldo");
 });
 it("rechecks final requirements semantically before publication",async()=>{
  const d=await service.createDraft(identity,org,{raw_text:"Registrar inventario y preparar pedidos"});
  await rejects(service.publishDraft(identity,org,d.id,publish([{competency_id:skill,requirement_type:"ESSENTIAL",stage:"ENTRY",description:"Excluir barrios vulnerables"}])),"DISCRIMINATORY_TERMS_BLOCKED");
 });
 it("rejects foreign catalog mappings before creating opportunities",async()=>{
  const d=await service.createDraft(identity,org,{raw_text:"Registrar inventario y preparar pedidos"});
  await rejects(service.publishDraft(identity,org,d.id,{...publish(),occupation_id:randomUUID()}),"INVALID_CATALOG_MAPPING");
  await rejects(service.publishDraft(identity,org,d.id,publish([{competency_id:randomUUID(),requirement_type:"ESSENTIAL",stage:"ENTRY",description:"Inventario"}])),"INVALID_CATALOG_MAPPING");
 });
 it("uses C01: missing entry skill is unknown, trainable does not bar entry, absent logistics stays pending",async()=>{
  const confirmed=await seedConfirmedD7Profile(f.db,candidate);
  const d=await service.createDraft(identity,org,{raw_text:"Registrar inventario y preparar pedidos"});
  const opp=await service.publishDraft(identity,org,d.id,publish([{competency_id:skill,requirement_type:"ESSENTIAL",stage:"ENTRY",description:"Inventario"},{competency_id:trainable,requirement_type:"ESSENTIAL",stage:"TRAINABLE",description:"Entrenable"}]));
  await f.admin.query('INSERT INTO app."CandidateApplication"(id,"opportunityId","candidateProfileId","profileRevisionId","receiptNumber","updatedAt") VALUES($1,$2,$3,$4,$5,NOW())',[randomUUID(),opp.id,profile,confirmed.current_version_id,randomUUID()]);
  const result=await service.listApplicationsForOpportunity(identity,org,opp.id);
  expect(result[0].gaps.find(g=>g.competency_id===skill)?.status).toBe("DESCONOCIDO");
  expect(result[0].feasibility).toBe("PENDIENTE");
  expect(result[0].skills.every(s=>s.status!=="DOCUMENTADO")).toBe(true);
 },15000);
 it("publishes against the draft's original catalog even after a newer catalog appears",async()=>{
  const d=await service.createDraft(identity,org,{raw_text:"Registrar inventario y preparar pedidos"});
  const newer=randomUUID();await f.admin.query('INSERT INTO app."CatalogVersion"(id,code,"sourceLabel","createdAt") VALUES($1,\'SAFETY-NEW\',\'New\',NOW()+interval \'1 day\')',[newer]);
  const result=await service.publishDraft(identity,org,d.id,publish());
  expect((await f.admin.query('SELECT "catalogVersionId" FROM app."Opportunity" WHERE id=$1',[result.id])).rows[0].catalogVersionId).toBe(catalog);
 });

});
