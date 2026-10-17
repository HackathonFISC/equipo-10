import {randomUUID,createHash} from "node:crypto";
import type {Prisma} from "../../../../../generated/prisma/client.js";
import type {VerifiedIdentity} from "../../security/auth";
import type {CoursesDatabase} from "../courses/courses.service";
import {AppError} from "../../errors";
import {AssessmentBankProposalSchema,AssessmentBankConfirmationSchema,AssessmentSubmissionSchema,type AssessmentBank,type AssessmentBankConfirmation,type AssessmentSubmission,type AssessmentAttemptPublic,type AssessmentResult} from "@equipo10/contracts";
import {runAssessmentVertex,type AssessmentRunner,type AssessmentSource} from "./assessment-agent.service";
interface AttemptRow{id:string;bankId:string;profileId:string;snapshot:AssessmentBank;result:AssessmentResult|null;submittedAt:Date|null;associated:boolean;}
export class TrainingAssessmentsService{
 constructor(private readonly db:CoursesDatabase,private readonly runner:AssessmentRunner=runAssessmentVertex){}
 private async actor(identity:VerifiedIdentity){const actor=await this.db.resolveAuthSubject(identity.id,false);if(!actor)throw new AppError(404,"ACCOUNT_NOT_INITIALIZED","Cuenta no disponible");return actor;}
 private async center(tx:Prisma.TransactionClient,org:string){const rows=await tx.$queryRaw<{allowed:boolean}[]>`SELECT app.can_manage_training_center(${org}::uuid) AS allowed`;if(!rows[0]?.allowed)throw new AppError(404,"TRAINING_CENTER_NOT_FOUND","Centro no disponible");}
 private async source(tx:Prisma.TransactionClient,org:string,course:string):Promise<AssessmentSource>{
  const c=await tx.course.findFirst({where:{id:course,organizationId:org,active:true},include:{versions:{take:1,orderBy:{versionNumber:"desc"},include:{learningOutcomes:{include:{competency:true}}}}}});
  const v=c?.versions[0];if(!v || !v.learningOutcomes.length)throw new AppError(409,"CONFIRMED_MAP_REQUIRED","Publica y confirma el mapa del curso antes de generar el banco");
  return {course_version_id:v.id,catalog_version_id:v.catalogVersionId,syllabus_text:v.syllabusText,outcomes:v.learningOutcomes.map(x=>({competency_id:x.competencyId,name:x.competency.name,description:x.description}))};
 }
 private validateQuestions(source:AssessmentSource,questions:AssessmentBankConfirmation["questions"]){if(questions.some(q=>!source.syllabus_text.includes(q.quote)||!source.outcomes.some(o=>o.competency_id===q.competency_id)))throw new AppError(422,"INVALID_ASSESSMENT_SOURCE","Cada pregunta requiere una cita literal y una habilidad del mapa confirmado");}
 private async operation<T>(identity:VerifiedIdentity,operation:string,key:string,input:unknown,fn:(tx:Prisma.TransactionClient,actor:string)=>Promise<T>,authorize:(tx:Prisma.TransactionClient,actor:string)=>Promise<unknown>){
  if(!/^[\x21-\x7e]{16,128}$/.test(key))throw new AppError(400,"INVALID_IDEMPOTENCY_KEY","Clave de operación inválida");
  const actor=await this.actor(identity),hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return this.db.withActor(actor,async tx=>{
   await authorize(tx,actor);
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${actor}:${operation}:${key}`},0))`;
   const previous=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation,idempotencyKey:key}}});
   if(previous){if(previous.payloadHash!==hash)throw new AppError(409,"IDEMPOTENCY_CONFLICT","La clave corresponde a otra acción");return previous.receiptPayload as T;}
   const result=await fn(tx,actor);
   const receipt=await tx.operationReceipt.create({data:{actorUserId:actor,operation,idempotencyKey:key,payloadHash:hash,receiptPayload:result as Prisma.InputJsonValue}});
   await tx.auditEvent.create({data:{actorUserId:actor,operationId:receipt.id,caseId:"CU02",event:operation,reasonCode:"EXPLICIT_HUMAN_CONFIRMATION"}});
   return result;
  },{timeout:15000});
 }
 async propose(identity:VerifiedIdentity,org:string,course:string,consent:boolean){
  if(consent!==true)throw new AppError(422,"CONSENT_REQUIRED","Confirma el análisis del temario");
  const actor=await this.actor(identity),source=await this.db.withActor(actor,async tx=>{await this.center(tx,org);return this.source(tx,org,course);});
  const response=AssessmentBankProposalSchema.safeParse(await this.runner(source));
  if(!response.success)throw new AppError(502,"INVALID_ASSESSMENT_BANK","El agente devolvió un banco incompleto",true);
  const result=response.data;
  if(result.course_version_id!==source.course_version_id||result.catalog_version_id!==source.catalog_version_id)throw new AppError(502,"INVALID_ASSESSMENT_BANK","El agente utilizó otra versión",true);
  try{this.validateQuestions(source,result.questions);}catch{throw new AppError(502,"INVALID_ASSESSMENT_BANK","El banco no tiene fuentes verificables",true);}
  return result;
 }
 async banks(identity:VerifiedIdentity,org:string,course:string){const actor=await this.actor(identity);return this.db.withActor(actor,async tx=>{await this.center(tx,org);await this.source(tx,org,course);const rows=await tx.$queryRaw<{snapshot:AssessmentBank}[]>`SELECT b.snapshot FROM app."TrainingAssessmentBank" b JOIN app."CourseVersion" v ON v.id=b."courseVersionId" WHERE v."courseId"=${course}::uuid ORDER BY b."createdAt" DESC,b.id DESC`;return {items:rows.map(r=>r.snapshot)};});}
 async confirmBank(identity:VerifiedIdentity,org:string,course:string,raw:AssessmentBankConfirmation,key:string){const body=AssessmentBankConfirmationSchema.parse(raw);return this.operation(identity,"TRAINING_ASSESSMENT_BANK",key,{org,course,body},async(tx,actor)=>{
  await this.center(tx,org);await tx.$queryRaw`SELECT id FROM app."Course" WHERE id=${course}::uuid FOR UPDATE`;
  const source=await this.source(tx,org,course);if(source.course_version_id!==body.course_version_id)throw new AppError(409,"ASSESSMENT_VERSION_OUTDATED","El mapa cambió. Genera el banco sobre la versión actual");this.validateQuestions(source,body.questions);
  const bank:AssessmentBank={id:randomUUID(),course_version_id:source.course_version_id,catalog_version_id:source.catalog_version_id,questions:body.questions,created_at:new Date().toISOString()};
  const snapshot={...bank,source_snapshot:source};
  await tx.$executeRaw`INSERT INTO app."TrainingAssessmentBank"(id,"courseVersionId","createdBy",snapshot) VALUES(${bank.id}::uuid,${bank.course_version_id}::uuid,${actor}::uuid,${JSON.stringify(snapshot)}::jsonb)`;return bank;
 },tx=>this.center(tx,org));}
 async metadata(identity:VerifiedIdentity,course:string){const actor=await this.actor(identity);return this.db.withActor(actor,async tx=>{const rows=await tx.$queryRaw<{id:string;courseVersionId:string;questionCount:number}[]>`SELECT * FROM app.training_assessment_bank_metadata(${course}::uuid)`;const b=rows[0];if(!b)throw new AppError(404,"ASSESSMENT_BANK_UNAVAILABLE","Este curso todavía no tiene un banco revisado");return {id:b.id,course_version_id:b.courseVersionId,question_count:b.questionCount};});}
 private async attempt(tx:Prisma.TransactionClient,id:string,lock=false):Promise<AttemptRow>{
  if(lock)await tx.$queryRaw`SELECT id FROM app."TrainingAssessmentAttempt" WHERE id=${id}::uuid FOR UPDATE`;
  const rows=await tx.$queryRaw<AttemptRow[]>`SELECT a.*, EXISTS(SELECT 1 FROM app."TrainingAssessmentAssociation" s WHERE s."attemptId"=a.id) AS associated FROM app."TrainingAssessmentAttempt" a WHERE a.id=${id}::uuid`;
  if(!rows[0])throw new AppError(404,"ASSESSMENT_ATTEMPT_NOT_FOUND","Intento no disponible");return rows[0];
 }
 private view(a:AttemptRow):AssessmentAttemptPublic{return {id:a.id,bank_id:a.bankId,status:a.submittedAt?"SUBMITTED":"STARTED",questions:a.snapshot.questions.map(q=>({id:q.id,prompt:q.prompt,options:q.options.map(o=>({id:o.id,text:o.text}))})),result:a.result,association_confirmed:a.associated};}
 async start(identity:VerifiedIdentity,course:string,body:{bank_id:string;consent:true},key:string){if(body.consent!==true)throw new AppError(422,"CONSENT_REQUIRED","Confirma que deseas responder");return this.operation(identity,"TRAINING_ASSESSMENT_START",key,{course,body},async(tx,actor)=>{
  const profile=await tx.candidateProfile.findUnique({where:{ownerUserId:actor}});if(!profile)throw new AppError(409,"PROFILE_REQUIRED","Crea tu perfil antes de responder");
  const current=await tx.$queryRaw<{id:string}[]>`SELECT id FROM app.training_assessment_bank_metadata(${course}::uuid)`;if(current[0]?.id!==body.bank_id)throw new AppError(409,"ASSESSMENT_BANK_OUTDATED","El banco cambió; vuelve a cargar el curso");
  const id=randomUUID();await tx.$queryRaw`SELECT app.start_training_assessment(${course}::uuid,${body.bank_id}::uuid,${id}::uuid)`;return this.view(await this.attempt(tx,id));
 },async(tx,actor)=>{if(!await tx.candidateProfile.findUnique({where:{ownerUserId:actor}}))throw new AppError(409,"PROFILE_REQUIRED","Crea tu perfil antes de responder");});}
 async getAttempt(identity:VerifiedIdentity,id:string){const actor=await this.actor(identity);return this.db.withActor(actor,async tx=>this.view(await this.attempt(tx,id)));}
 async listAttempts(identity:VerifiedIdentity,course:string){const actor=await this.actor(identity);return this.db.withActor(actor,async tx=>{
  const rows=await tx.$queryRaw<AttemptRow[]>`SELECT a.*,EXISTS(SELECT 1 FROM app."TrainingAssessmentAssociation" s WHERE s."attemptId"=a.id) AS associated FROM app."TrainingAssessmentAttempt" a JOIN app."CourseVersion" v ON v.id=(a.snapshot->>'course_version_id')::uuid WHERE v."courseId"=${course}::uuid ORDER BY a."createdAt" DESC LIMIT 50`;
  return {items:rows.map(a=>this.view(a))};
 });}
 async submit(identity:VerifiedIdentity,id:string,raw:AssessmentSubmission,key:string){const body=AssessmentSubmissionSchema.parse(raw);return this.operation(identity,"TRAINING_ASSESSMENT_SUBMIT",key,{id,body},async tx=>{
  const a=await this.attempt(tx,id,true);if(a.submittedAt)throw new AppError(409,"ASSESSMENT_ALREADY_SUBMITTED","El intento ya fue respondido; consulta su resultado");
  if(body.answers.length!==a.snapshot.questions.length || body.answers.some(answer=>!a.snapshot.questions.some(q=>q.id===answer.question_id&&q.options.some(o=>o.id===answer.option_id))))throw new AppError(422,"ASSESSMENT_ANSWERS_INVALID","Responde todas las preguntas con una opción válida");
  const items=a.snapshot.questions.map(q=>({question_id:q.id,correct:body.answers.find(x=>x.question_id===q.id)!.option_id===q.correct_option_id,feedback:q.rationale}));
  const result:AssessmentResult={correct_count:items.filter(i=>i.correct).length,total_count:items.length,scope:"EXERCISE_ONLY",items};
  await tx.$executeRaw`UPDATE app."TrainingAssessmentAttempt" SET answers=${JSON.stringify(body.answers)}::jsonb,result=${JSON.stringify(result)}::jsonb,"submittedAt"=NOW() WHERE id=${id}::uuid`;
  return this.view(await this.attempt(tx,id));
 },tx=>this.attempt(tx,id));}
 async associate(identity:VerifiedIdentity,id:string,confirm:boolean,key:string){if(confirm!==true)throw new AppError(422,"CONFIRMATION_REQUIRED","Confirma la asociación al perfil");return this.operation(identity,"TRAINING_ASSESSMENT_ASSOCIATE",key,{id,confirm},async(tx,actor)=>{
  const a=await this.attempt(tx,id,true);if(!a.submittedAt)throw new AppError(409,"ASSESSMENT_NOT_SUBMITTED","Primero responde y revisa el resultado");
  const prior=await tx.$queryRaw<{id:string}[]>`SELECT id FROM app."TrainingAssessmentAssociation" WHERE "attemptId"=${id}::uuid`;
  if(prior[0])return {attempt_id:id,association_id:prior[0].id,scope:"EXERCISE_ONLY" as const};
  const profile=await tx.candidateProfile.findUnique({where:{ownerUserId:actor}});if(!profile?.currentVersionId)throw new AppError(409,"CONFIRMED_PROFILE_REQUIRED","Confirma tu perfil antes de asociar este ejercicio");
  const association=randomUUID(),snapshot={attempt_id:id,profile_version_id:profile.currentVersionId,scope:"EXERCISE_ONLY",bank_snapshot:a.snapshot,result:a.result,does_not_accredit_competency:true};
  await tx.$executeRaw`INSERT INTO app."TrainingAssessmentAssociation"(id,"attemptId","profileId",snapshot) VALUES(${association}::uuid,${id}::uuid,${a.profileId}::uuid,${JSON.stringify(snapshot)}::jsonb)`;
  return {attempt_id:id,association_id:association,scope:"EXERCISE_ONLY" as const};
 },tx=>this.attempt(tx,id));}
}
