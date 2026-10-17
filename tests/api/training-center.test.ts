import { beforeAll, afterAll, describe, it, expect } from "bun:test";
import { randomUUID } from "node:crypto";
import { setupTestDatabase } from "../support/training-center-database-fixture";
import { TrainingCenterService } from "../../apps/api/src/modules/training-center/training-center.service";
import { CoursesService } from "../../apps/api/src/modules/courses/courses.service";
import { TrainingCoursePublicationSchema } from "../../packages/contracts/src/training-center";
import type { SyllabusRunner } from "../../apps/api/src/modules/training-center/syllabus-agent.service";

async function rejectsWith(task:Promise<unknown>, expected:Record<string,unknown>){ let caught:unknown; try{await task;}catch(error){caught=error;} expect(caught).toBeDefined(); expect(caught).toMatchObject(expected); }
describe("D7 A center authoring, catalog citations and atomic publication",()=>{
  let fixture:Awaited<ReturnType<typeof setupTestDatabase>>;
  let service:TrainingCenterService;
  const actor=randomUUID(), outsider=randomUUID(), candidate=randomUUID();
  const auth=randomUUID(), otherAuth=randomUUID(), candidateAuth=randomUUID();
  const org=randomUUID(), otherOrg=randomUUID(),catalog=randomUUID(),skill=randomUUID();
  const identity={id:auth,email:"center@example.test"}, otherIdentity={id:otherAuth,email:"other@example.test"}, candidateIdentity={id:candidateAuth,email:"candidate@example.test"};
  const source="El curso enseña registro de inventario con hojas de cálculo.";
  let answers:string[]=[];
  const runner:SyllabusRunner=async input=>{
    answers=input.request.answers;
    return {catalog_version_id:catalog,provider:"vertex",questions:[],proposals:[{competency_id:skill,name:"Registro de inventario",description:"Registrar inventario",quote:"registro de inventario",is_prerequisite:false}]};
  };
  beforeAll(async()=>{
    fixture=await setupTestDatabase();
    for(const [id,subject] of [[actor,auth],[outsider,otherAuth],[candidate,candidateAuth]])
      await fixture.admin.query('INSERT INTO app."AppUser" (id,"authSubject","updatedAt") VALUES ($1,$2,NOW())',[id,subject]);
    for(const id of [org,otherOrg]) await fixture.admin.query('INSERT INTO app."Organization" (id,name,type,"updatedAt") VALUES ($1,$2,\'TRAINING_CENTER\',NOW())',[id,"Centro DEMO"]);
    for(const [user,organization] of [[actor,org],[outsider,otherOrg]]) await fixture.admin.query('INSERT INTO app."OrganizationMembership" (id,"userId","organizationId",role,"updatedAt") VALUES ($1,$2,$3,\'TRAINING_MANAGER\',NOW())',[randomUUID(),user,organization]);
    await fixture.admin.query('INSERT INTO app."CatalogVersion" (id,code,"sourceLabel") VALUES ($1,\'D7-DEMO\',\'Synthetic\')',[catalog]);
    await fixture.admin.query('INSERT INTO app."CompetencyEntry" (id,"catalogVersionId",code,name,description,kind) VALUES ($1,$2,\'D7-SKILL\',\'Registro de inventario\',\'Inventario\',\'SKILL\')',[skill,catalog]);
    service=new TrainingCenterService(fixture.db,runner);
  },30000);
  afterAll(async()=>{await fixture?.close();});
  async function draft(){return service.create(identity,org,{code:"INV",title:"Inventarios",description:"Curso de inventario"},randomUUID());}
  function publication(updated:string){return {
    expected_updated_at:updated,syllabus_text:source,catalog_version_id:catalog,confirm:true as const,
    outcomes:[{competency_id:skill,description:"Registrar inventario",quote:"registro de inventario"}],prerequisites:[],
    edition:{modality:"REMOTE" as const,location:"En línea",start_date:"2027-01-04",end_date:"2027-01-25",total_slots:2,cost_amount:0,cost_currency:"USD",cost_period:"TOTAL" as const,sessions:[{weekday:1,start_minute:600,end_minute:660,timezone:"America/Panama"}]},
  };}
  it("denies candidate role and another center",async()=>{
    await rejectsWith(service.list(candidateIdentity,org), {status:404});
    await rejectsWith(service.list(otherIdentity,org), {status:404});
  });
  it("creates a private draft once under same-key retry",async()=>{
    const key=randomUUID(),data={code:"INV",title:"Privado",description:"Borrador"};
    const a=await service.create(identity,org,data,key);
    const b=await service.create(identity,org,data,key);
    expect(a.id).toBe(b.id);expect(a.active).toBe(false);
    let error:unknown;
    try {await service.create(identity,org,{...data,title:"Otro"},key);}catch(caught){error=caught;}
    expect(error).toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
    await fixture.admin.query("BEGIN");
    try {
      await fixture.admin.query("SET LOCAL ROLE equipo10_runtime");
      await fixture.admin.query("SELECT set_config('app.actor_user_id', $1,true)",[candidate]);
      const visible=await fixture.admin.query('SELECT count(*)::int AS count FROM app."Course" WHERE id=$1',[a.id]);
      expect(visible.rows[0].count).toBe(0);
    }finally{await fixture.admin.query("ROLLBACK");}
  });
  it("persists reviewed source, answers and choices across reload with replay and ownership",async()=>{
    const d=await draft();
    const interpretation=await service.interpret(identity,org,d.id,{syllabus_text:source,answers:["Sin experiencia previa"],consent:true});
    const workspace={expected_updated_at:d.updated_at,syllabus_text:source,answers:["Sin experiencia previa"],interpretation,chosen:[true]};
    const key=randomUUID();
    const saved=await service.saveWorkspace(identity,org,d.id,workspace,key);
    const replay=await service.saveWorkspace(identity,org,d.id,workspace,key);
    expect(replay.updated_at).toBe(saved.updated_at);
    const reloaded=await new TrainingCenterService(fixture.db,runner).detail(identity,org,d.id);
    expect(reloaded.workspace?.syllabus_text).toBe(source);
    expect(reloaded.workspace?.answers).toEqual(["Sin experiencia previa"]);
    expect(reloaded.workspace?.chosen).toEqual([true]);
    let denied:unknown;
    try {await service.saveWorkspace(otherIdentity,otherOrg,d.id,{...workspace,expected_updated_at:saved.updated_at},randomUUID());} catch(error){denied=error;}
    expect(denied).toMatchObject({status:404});
    let outdated:unknown;
    try {await service.saveWorkspace(identity,org,d.id,workspace,randomUUID());} catch(error){outdated=error;}
    expect(outdated).toMatchObject({code:"COURSE_OUTDATED"});
  });
  it("sends human answers and source/catalog to injected agent",async()=>{
    const d=await draft();
    const result=await service.interpret(identity,org,d.id,{syllabus_text:source,consent:true,answers:["No requiere conocimientos previos"]});
    expect(answers).toEqual(["No requiere conocimientos previos"]);expect(result.proposals[0].competency_id).toBe(skill);
  });
  it("rejects invented source quotes and never falls back on provider failure",async()=>{
    const d=await draft();
    const bad=new TrainingCenterService(fixture.db,async()=>({catalog_version_id:catalog,provider:"vertex",questions:[],proposals:[{competency_id:skill,name:"Inventario",description:"Inventario",quote:"cita inventada",is_prerequisite:false}]}));
    await rejectsWith(bad.interpret(identity,org,d.id,{syllabus_text:source,consent:true,answers:[]}), {code:"INVALID_SYLLABUS_MAPPING"});
    const unavailable=new TrainingCenterService(fixture.db,async()=>{throw new Error("provider offline");});
    await rejectsWith(unavailable.interpret(identity,org,d.id,{syllabus_text:source,consent:true,answers:[]}), {message:"provider offline"});
    expect((await service.detail(identity,org,d.id)).active).toBe(false);
  });
  it("validates source, dates, overlap and consent before publication",()=>{
    const p=publication(new Date().toISOString());
    expect(TrainingCoursePublicationSchema.safeParse({...p,confirm:false}).success).toBe(false);
    expect(TrainingCoursePublicationSchema.safeParse({...p,outcomes:[{...p.outcomes[0],quote:"inventado"}]}).success).toBe(false);
    expect(TrainingCoursePublicationSchema.safeParse({...p,edition:{...p.edition,end_date:"2027-02-30"}}).success).toBe(false);
    expect(TrainingCoursePublicationSchema.safeParse({...p,edition:{...p.edition,sessions:[...p.edition.sessions,...p.edition.sessions]}}).success).toBe(false);
  });
  it("rejects catalog mismatches and stale drafts with no partial version",async()=>{
    const d=await draft(),p=publication(d.updated_at);
    await rejectsWith(service.publish(identity,org,d.id,{...p,outcomes:[{...p.outcomes[0],competency_id:randomUUID()}]},randomUUID()), {code:"UNKNOWN_COMPETENCY"});
    await rejectsWith(service.publish(identity,org,d.id,{...p,expected_updated_at:"2020-01-01T00:00:00.000Z"},randomUUID()), {code:"COURSE_OUTDATED"});
    expect((await service.detail(identity,org,d.id)).versions).toHaveLength(0);
  });
  it("publishes atomically, replays once and becomes visible through D4",async()=>{
    const d=await draft(),p=publication(d.updated_at),key=randomUUID();
    const [a,b]=await Promise.all([service.publish(identity,org,d.id,p,key),service.publish(identity,org,d.id,p,key)]);
    expect(a.receipt_id).toBe(b.receipt_id);
    const detail=await service.detail(identity,org,d.id);
    expect(detail.active).toBe(true);expect(detail.versions).toHaveLength(1);expect(detail.versions[0].editions[0].available_slots).toBe(2);
    const publicDetail=await new CoursesService(fixture.db).getCourseDetail(candidateIdentity,d.id);
    expect(publicDetail.id).toBe(d.id);
    const receipt=(await fixture.admin.query('SELECT "receiptPayload" FROM app."OperationReceipt" WHERE id=$1',[a.receipt_id])).rows[0].receiptPayload;
    expect(receipt.reviewed_mapping.outcomes[0].quote).toBe("registro de inventario");
    await rejectsWith(service.publish(identity,org,d.id,p,randomUUID()), {code:"COURSE_ALREADY_PUBLISHED"});
    await rejectsWith(service.detail(otherIdentity,otherOrg,d.id), {status:404});
  });
});

