import { randomUUID, createHash } from "node:crypto";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { VerifiedIdentity } from "../../security/auth";
import { AppError } from "../../errors";
import type { CoursesDatabase } from "../courses/courses.service";
import { TrainingCourseDraftSchema, TrainingCoursePublicationSchema, SyllabusInterpretRequestSchema, SyllabusInterpretationSchema } from "../../../../../packages/contracts/src/training-center";
import type { TrainingCourseDraft, TrainingCoursePublication, SyllabusInterpretRequest, TrainingCourseSummary } from "../../../../../packages/contracts/src/training-center";
import { runSyllabusVertex, type SyllabusRunner } from "./syllabus-agent.service";
import { TrainingCourseWorkspaceSchema, type TrainingCourseWorkspace } from '@equipo10/contracts';

export class TrainingCenterService {
  constructor(private readonly db: CoursesDatabase, private readonly runner: SyllabusRunner = runSyllabusVertex) {}

  private async actor(identity: VerifiedIdentity) {
    const actor = await this.db.resolveAuthSubject(identity.id, false);
    if (!actor) throw new AppError(404,"ACCOUNT_NOT_INITIALIZED","Cuenta no inicializada");
    return actor;
  }

  private async authorize(tx: Prisma.TransactionClient, actor: string, organizationId: string) {
    const member = await tx.organizationMembership.findFirst({where:{userId:actor,organizationId,status:"ACTIVE",role:{in:["TRAINING_MANAGER","ADMIN"]},organization:{active:true,type:"TRAINING_CENTER"}}});
    if(!member) throw new AppError(404,"TRAINING_CENTER_NOT_FOUND","Centro no disponible");
  }

  private summary(course: {id:string;code:string;title:string;description:string;active:boolean;updatedAt:Date}): TrainingCourseSummary {
    return {id:course.id,code:course.code,title:course.title,description:course.description,active:course.active,updated_at:course.updatedAt.toISOString()};
  }

  async list(identity: VerifiedIdentity, organizationId: string) {
    const actor = await this.actor(identity);
    return this.db.withActor(actor,async tx => {
      await this.authorize(tx,actor,organizationId);
      const courses = await tx.course.findMany({where:{organizationId},orderBy:{updatedAt:"desc"},take:100});
      return {items:courses.map(c => this.summary(c)),total:courses.length};
    });
  }

  async create(identity: VerifiedIdentity, organizationId: string, raw: TrainingCourseDraft, key:string) {
    if(!/^[\x21-\x7e]{16,128}$/.test(key)) throw new AppError(400,"INVALID_IDEMPOTENCY_KEY","Se requiere clave de idempotencia de 16 a 128 caracteres");
    const data = TrainingCourseDraftSchema.parse(raw);
    const actor = await this.actor(identity);
    const hash=createHash("sha256").update(JSON.stringify({organizationId,data})).digest("hex");
    return this.db.withActor(actor,async tx => {
      await this.authorize(tx,actor,organizationId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`training-draft:${actor}:${key}`}, 0))`;
      const previous=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:"TRAINING_COURSE_DRAFT",idempotencyKey:key}}});
      if(previous){
        if(previous.payloadHash!==hash) throw new AppError(409,"IDEMPOTENCY_CONFLICT","La clave corresponde a otro borrador");
        return previous.receiptPayload as unknown as TrainingCourseSummary;
      }
      // Code is informational; a scoped random suffix avoids conflicts across centers.
      const code = `${data.code.slice(0,32)}-${randomUUID().slice(0,8)}`;
      const course = await tx.course.create({data:{...data,code,organizationId,active:false,isDemo:false}});
      const result=this.summary(course);
      const receipt=await tx.operationReceipt.create({data:{actorUserId:actor,operation:"TRAINING_COURSE_DRAFT",idempotencyKey:key,payloadHash:hash,receiptPayload:result as unknown as Prisma.InputJsonValue}});
      await tx.auditEvent.create({data:{actorUserId:actor,operationId:receipt.id,caseId:"CU11",event:"TRAINING_COURSE_DRAFT_CREATED",reasonCode:"CENTER_REQUESTED"}});
      return result;
    });
  }

  async detail(identity: VerifiedIdentity, organizationId: string, courseId: string) {
    const actor = await this.actor(identity);
    return this.db.withActor(actor,async tx => {
      await this.authorize(tx,actor,organizationId);
      const course=await tx.course.findFirst({where:{id:courseId,organizationId},include:{versions:{include:{learningOutcomes:true,prerequisites:true,editions:true},orderBy:{versionNumber:"desc"}}}});
      if(!course) throw new AppError(404,"COURSE_NOT_FOUND","Curso no disponible");
      const workspaces=await tx.$queryRaw<{payload:TrainingCourseWorkspace}[]>`SELECT payload FROM app."TrainingCourseWorkspace" WHERE "courseId"=${courseId}::uuid`;
      return {...this.summary(course), workspace:workspaces[0]?.payload ?? null, versions:course.versions.map(v=>({id:v.id,catalog_version_id:v.catalogVersionId,version_number:v.versionNumber,syllabus_text:v.syllabusText,
        outcomes:v.learningOutcomes.map(x=>({competency_id:x.competencyId,description:x.description})),
        prerequisites:v.prerequisites.map(x=>({competency_id:x.competencyId,description:x.description})),
        editions:v.editions.map(e=>({id:e.id,modality:e.modality,location:e.location,start_date:e.startDate.toISOString().slice(0,10),end_date:e.endDate.toISOString().slice(0,10),total_slots:e.totalSlots,available_slots:e.availableSlots}))}))};
    });
  }

  async saveWorkspace(identity:VerifiedIdentity,organizationId:string,courseId:string,raw:TrainingCourseWorkspace,key:string) {
    if(!/^[\x21-\x7e]{16,128}$/.test(key)) throw new AppError(400,'INVALID_IDEMPOTENCY_KEY','Se requiere una clave de operación válida');
    const body=TrainingCourseWorkspaceSchema.parse(raw),actor=await this.actor(identity);
    const hash=createHash('sha256').update(JSON.stringify({organizationId,courseId,body})).digest('hex');
    return this.db.withActor(actor,async tx=>{
      await this.authorize(tx,actor,organizationId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`workspace:${actor}:${key}`},0))`;
      const prior=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:'TRAINING_WORKSPACE_SAVE',idempotencyKey:key}}});
      if(prior) {
        if(prior.payloadHash!==hash) throw new AppError(409,'IDEMPOTENCY_CONFLICT','La clave corresponde a otro avance');
        return prior.receiptPayload as unknown as {workspace:TrainingCourseWorkspace;updated_at:string};
      }
      await tx.$queryRaw`SELECT id FROM app."Course" WHERE id=${courseId}::uuid FOR UPDATE`;
      const course=await tx.course.findFirst({where:{id:courseId,organizationId}});
      if(!course) throw new AppError(404,'COURSE_NOT_FOUND','Curso no disponible');
      if(course.active) throw new AppError(409,'COURSE_ALREADY_PUBLISHED','El curso publicado conserva su versión');
      if(course.updatedAt.toISOString()!==body.expected_updated_at) throw new AppError(409,'COURSE_OUTDATED','El curso cambió. Vuelve a cargarlo antes de guardar');
      if(body.interpretation) {
        const mapping=body.interpretation;
        const valid=await tx.competencyEntry.findMany({where:{catalogVersionId:mapping.catalog_version_id,id:{in:mapping.proposals.map(p=>p.competency_id)}}});
        if(mapping.proposals.some(p=>!valid.some(c=>c.id===p.competency_id && c.name===p.name))) throw new AppError(422,'INVALID_SYLLABUS_MAPPING','Las habilidades no pertenecen al catálogo');
      }
      const updated=await tx.course.update({where:{id:courseId},data:{updatedAt:new Date()}});
      const workspace={...body,expected_updated_at:updated.updatedAt.toISOString()};
      const json=JSON.stringify(workspace);
      await tx.$executeRaw`INSERT INTO app."TrainingCourseWorkspace" ("courseId",payload) VALUES (${courseId}::uuid,${json}::jsonb) ON CONFLICT ("courseId") DO UPDATE SET payload=EXCLUDED.payload,"updatedAt"=NOW()`;
      const result={workspace,updated_at:updated.updatedAt.toISOString()};
      const receipt=await tx.operationReceipt.create({data:{actorUserId:actor,operation:'TRAINING_WORKSPACE_SAVE',idempotencyKey:key,payloadHash:hash,receiptPayload:result as unknown as Prisma.InputJsonValue}});
      await tx.auditEvent.create({data:{actorUserId:actor,operationId:receipt.id,caseId:'CU11',event:'TRAINING_WORKSPACE_SAVED',reasonCode:'CENTER_REQUESTED'}});
      return result;
    },{timeout:15000});
  }

  async interpret(identity:VerifiedIdentity, organizationId:string,courseId:string, raw:SyllabusInterpretRequest) {
    const request=SyllabusInterpretRequestSchema.parse(raw);
    const actor=await this.actor(identity);
    const catalog = await this.db.withActor(actor,async tx=>{
      await this.authorize(tx,actor,organizationId);
      if(!await tx.course.findFirst({where:{id:courseId,organizationId}})) throw new AppError(404,"COURSE_NOT_FOUND","Curso no disponible");
      const version=await tx.catalogVersion.findFirst({orderBy:[{createdAt:"desc"},{id:"desc"}],include:{competencies:{orderBy:{code:"asc"}}}});
      if(!version || !version.competencies.length) throw new AppError(409,"CATALOG_EMPTY","No hay catálogo disponible para mapear el temario");
      return {id:version.id,competencies:version.competencies.map(c=>({id:c.id,name:c.name,description:c.description}))};
    });
    const response=SyllabusInterpretationSchema.safeParse(await this.runner({request,catalog}));
    if(!response.success) throw new AppError(502,"INVALID_SYLLABUS_MAPPING","El análisis no devolvió propuestas completas; puedes reintentar.",true);
    const interpretation=response.data;
    if(interpretation.catalog_version_id!==catalog.id || interpretation.proposals.some(p=>!catalog.competencies.some(c=>c.id===p.competency_id && c.name===p.name) || !request.syllabus_text.includes(p.quote)))
      throw new AppError(502,"INVALID_SYLLABUS_MAPPING","El análisis no devolvió referencias verificables. Puedes reintentar.",true);
    await this.db.withActor(actor,async tx=>{
      await this.authorize(tx,actor,organizationId);
      await tx.auditEvent.create({data:{actorUserId:actor,caseId:"CU11",event:"TRAINING_SYLLABUS_ANALYZED",reasonCode:"A01_VERTEX_REVIEW_REQUIRED"}});
    });
    return interpretation;
  }

  async publish(identity:VerifiedIdentity,organizationId:string,courseId:string, raw:TrainingCoursePublication,key:string) {
    if(!/^[\x21-\x7e]{16,128}$/.test(key)) throw new AppError(400,"INVALID_IDEMPOTENCY_KEY","Se requiere clave de idempotencia de 16 a 128 caracteres");
    const body=TrainingCoursePublicationSchema.parse(raw);
    const actor=await this.actor(identity);
    const hash=createHash("sha256").update(JSON.stringify({organizationId,courseId,body})).digest("hex");
    return this.db.withActor(actor,async tx=>{
      await this.authorize(tx,actor,organizationId);
      // Serialize both same-key retries and publication of this course; never hold this lock during Vertex.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`training:${actor}:${key}`}, 0))`;
      const previous=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:"TRAINING_COURSE_PUBLISH",idempotencyKey:key}}});
      if(previous){
        if(previous.payloadHash!==hash) throw new AppError(409,"IDEMPOTENCY_CONFLICT","La clave corresponde a otra publicación");
        return (previous.receiptPayload as any).result;
      }
      await tx.$queryRaw`SELECT id FROM app."Course" WHERE id = ${courseId}::uuid FOR UPDATE`;
      const course=await tx.course.findFirst({where:{id:courseId,organizationId},include:{_count:{select:{versions:true}}}});
      if(!course) throw new AppError(404,"COURSE_NOT_FOUND","Curso no disponible");
      if(course.active || course._count.versions) throw new AppError(409,"COURSE_ALREADY_PUBLISHED","Esta entrega solo permite la publicación inicial; no altera ediciones existentes");
      if(course.updatedAt.toISOString()!==body.expected_updated_at) throw new AppError(409,"COURSE_OUTDATED","El curso cambió; vuelve a cargarlo");
      const ids=[...new Set([...body.outcomes,...body.prerequisites].map(x=>x.competency_id))];
      const valid=await tx.competencyEntry.count({where:{catalogVersionId:body.catalog_version_id,id:{in:ids}}});
      if(valid!==ids.length) throw new AppError(422,"UNKNOWN_COMPETENCY","Una habilidad no pertenece al catálogo seleccionado");
      const version=await tx.courseVersion.create({data:{courseId,catalogVersionId:body.catalog_version_id,versionNumber:1,syllabusText:body.syllabus_text}});
      await tx.courseLearningOutcome.createMany({data:body.outcomes.map(x=>({courseVersionId:version.id,competencyId:x.competency_id,catalogVersionId:body.catalog_version_id,description:x.description}))});
      if(body.prerequisites.length) await tx.coursePrerequisite.createMany({data:body.prerequisites.map(x=>({courseVersionId:version.id,competencyId:x.competency_id,catalogVersionId:body.catalog_version_id,description:x.description,essential:true}))});
      const e=body.edition;
      const edition=await tx.courseEdition.create({data:{courseVersionId:version.id,modality:e.modality,location:e.location,startDate:new Date(`${e.start_date}T00:00:00Z`),endDate:new Date(`${e.end_date}T00:00:00Z`),totalSlots:e.total_slots,availableSlots:e.total_slots,costAmount:e.cost_amount,costCurrency:e.cost_currency,costPeriod:e.cost_period,scheduleSummary:e.sessions.map(s=>`${s.weekday}: ${String(Math.floor(s.start_minute/60)).padStart(2,"0")}:${String(s.start_minute%60).padStart(2,"0")}-${String(Math.floor(s.end_minute/60)).padStart(2,"0")}:${String(s.end_minute%60).padStart(2,"0")}`).join("; ").slice(0,200),active:true,isDemo:false}});
      await tx.courseSession.createMany({data:e.sessions.map(s=>({editionId:edition.id,weekday:s.weekday,startMinute:s.start_minute,endMinute:s.end_minute,timezone:s.timezone,location:s.location??e.location}))});
      await tx.course.update({where:{id:courseId},data:{active:true}});
      const result={course_id:courseId,version_id:version.id,edition_id:edition.id,receipt_id:randomUUID()};
      // Receipt preserves exact source quotes and reviewed mapping without adding a parallel content table.
      await tx.operationReceipt.create({data:{id:result.receipt_id,actorUserId:actor,operation:"TRAINING_COURSE_PUBLISH",idempotencyKey:key,payloadHash:hash,receiptPayload:{result,reviewed_mapping:{catalog_version_id:body.catalog_version_id,outcomes:body.outcomes,prerequisites:body.prerequisites}}}});
      await tx.auditEvent.create({data:{actorUserId:actor,operationId:result.receipt_id,caseId:"CU11",event:"TRAINING_COURSE_PUBLISHED",reasonCode:"CENTER_CONFIRMED"}});
      return result;
    },{timeout:15000,maxWait:8000});
  }
}
