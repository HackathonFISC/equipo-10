import { createHash,randomUUID } from 'node:crypto';
import { mkdir,writeFile,readFile,unlink,lstat } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import type { TrainingCertificateView } from '@equipo10/contracts';
import type { VerifiedIdentity } from '../../security/auth';
import type { TrainingParticipantsDatabase } from '../training-participants/training-participants.service';
import { AppError } from '../../errors';

type Row={id:string;completionId:string;originalFilename:string;contentType:'application/pdf';sizeBytes:number;sha256:string;recordedAt:Date};
const view=(r:Row):TrainingCertificateView=>({id:r.id,completion_id:r.completionId,original_filename:r.originalFilename,content_type:r.contentType,size_bytes:r.sizeBytes,sha256:r.sha256,recorded_at:r.recordedAt.toISOString()});
export interface CertificateFile { name:string;type:string;size:number;arrayBuffer():Promise<ArrayBuffer> }
export class TrainingCertificatesService {
  private readonly storageDir:string;
  constructor(private readonly db:TrainingParticipantsDatabase,storageDir?:string){
    this.storageDir=resolve(storageDir??resolve(import.meta.dir,'../../../../../.local/certificates'));
  }
  private async actor(identity:VerifiedIdentity){
    const actor=await this.db.resolveAuthSubject(identity.id,false);
    if(!actor)throw new AppError(404,'ACCOUNT_NOT_INITIALIZED','Cuenta no inicializada');return actor;
  }
  private async assertPermission(tx:Prisma.TransactionClient,org:string,completion:string){
    const [permission]=await tx.$queryRaw<{allowed:boolean}[]>`SELECT app.can_attach_training_certificate(${completion}::uuid,${org}::uuid) AS allowed`;
    if(!permission?.allowed)throw new AppError(404,'COMPLETION_NOT_AVAILABLE','Finalización no disponible para adjuntar certificado');
  }
  private path(id:string){
    if(!/^[0-9a-f-]{36}$/.test(id))throw new AppError(404,'CERTIFICATE_NOT_FOUND','Certificado no disponible');
    const path=resolve(this.storageDir,`${id}.pdf`);
    if(dirname(path)!==this.storageDir)throw new AppError(404,'CERTIFICATE_NOT_FOUND','Certificado no disponible');return path;
  }
  async upload(identity:VerifiedIdentity,organizationId:string,completionId:string,file:CertificateFile,key?:string){
    if(!key||!/^[\x21-\x7e]{16,128}$/.test(key))throw new AppError(400,'INVALID_IDEMPOTENCY_KEY','Clave de operación requerida');
    const actor=await this.actor(identity);
    await this.db.withActor(actor,tx=>this.assertPermission(tx,organizationId,completionId));
    if(file.type!=='application/pdf'||!file.name.toLowerCase().endsWith('.pdf'))throw new AppError(422,'CERTIFICATE_PDF_REQUIRED','Adjunta un certificado PDF existente');
    if(file.size<5||file.size>5*1024*1024)throw new AppError(413,'CERTIFICATE_TOO_LARGE','El PDF debe pesar como máximo 5 MB');
    const bytes=Buffer.from(await file.arrayBuffer());
    if(bytes.length!==file.size||bytes.subarray(0,5).toString()!=='%PDF-')throw new AppError(422,'INVALID_CERTIFICATE_PDF','El archivo no es un PDF válido');
    const filename=file.name.replaceAll('\\','/').split('/').at(-1)!.normalize('NFKC').replace(/[\u0000-\u001f\u007f"<>:|?*]/g,'_').slice(0,156).replace(/\.pdf$/i,'')+'.pdf';
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const hash=createHash('sha256').update(JSON.stringify({organizationId,completionId,filename,sha256,size:bytes.length})).digest('hex');
    await mkdir(this.storageDir,{recursive:true,mode:0o700});
    const dir=await lstat(this.storageDir);
    if(!dir.isDirectory()||dir.isSymbolicLink())throw new AppError(503,'CERTIFICATE_STORAGE_UNAVAILABLE','Almacenamiento privado no disponible',true);
    const id=randomUUID(),path=this.path(id);
    await writeFile(path,bytes,{flag:'wx',mode:0o600});
    let persisted=false;
    try{
      const result=await this.db.withActor(actor,async tx=>{
        await this.assertPermission(tx,organizationId,completionId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`certificate-key:${actor}:${key}`},0))`;
        const receipt=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:'TRAINING_CERTIFICATE_ATTACH',idempotencyKey:key}}});
        if(receipt){if(receipt.payloadHash!==hash)throw new AppError(409,'IDEMPOTENCY_CONFLICT','La clave corresponde a otro archivo');return {certificate:receipt.receiptPayload as unknown as TrainingCertificateView,isReplay:true};}
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`certificate:${completionId}`},0))`;
        const existing=await tx.$queryRaw<{id:string}[]>`SELECT id FROM app."TrainingCertificate" WHERE "completionId"=${completionId}::uuid`;
        if(existing.length)throw new AppError(409,'CERTIFICATE_ALREADY_ATTACHED','Este resultado ya tiene un certificado; no se sobrescribe');
        const [row]=await tx.$queryRaw<Row[]>`INSERT INTO app."TrainingCertificate"(id,"completionId","organizationId","actorUserId","originalFilename","contentType","sizeBytes",sha256)
          VALUES(${id}::uuid,${completionId}::uuid,${organizationId}::uuid,${actor}::uuid,${filename},'application/pdf',${bytes.length},${sha256}) RETURNING *`;
        const certificate=view(row!);
        const receiptRow=await tx.operationReceipt.create({data:{actorUserId:actor,operation:'TRAINING_CERTIFICATE_ATTACH',idempotencyKey:key,payloadHash:hash,receiptPayload:certificate as unknown as Prisma.InputJsonValue}});
        await tx.auditEvent.create({data:{actorUserId:actor,operationId:receiptRow.id,caseId:'D7_CERTIFICATE',event:'TRAINING_CERTIFICATE_ATTACHED',reasonCode:'CENTER_UPLOADED_EXISTING_DOCUMENT'}});
        return {certificate,isReplay:false};
      },{timeout:15000,maxWait:8000});
      persisted=!result.isReplay;
      return result;
    }catch(error){
      // A lost acknowledgement can follow a successful commit. Never remove its file.
      try{
        persisted=await this.db.withActor(actor,async tx=>{
          const receipt=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:'TRAINING_CERTIFICATE_ATTACH',idempotencyKey:key}}});
          // Receipt stays actor-readable even if centre membership was revoked after commit.
          return (receipt?.receiptPayload as {id?:string}|undefined)?.id===id;
        });
      }catch{persisted=true;} // Retain a private orphan if reconciliation itself is unavailable.
      throw error;
    }finally{if(!persisted)await unlink(path).catch(()=>{});}
  }
  async download(identity:VerifiedIdentity,certificateId:string){
    const actor=await this.actor(identity);
    const certificate=await this.db.withActor(actor,async tx=>{
      const [row]=await tx.$queryRaw<Row[]>`SELECT * FROM app."TrainingCertificate" WHERE id=${certificateId}::uuid`;
      if(!row)throw new AppError(404,'CERTIFICATE_NOT_FOUND','Certificado no disponible');return view(row);
    });
    let bytes:Buffer;
    try{const path=this.path(certificate.id);const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink())throw new Error();bytes=await readFile(path);}
    catch{throw new AppError(503,'CERTIFICATE_FILE_UNAVAILABLE','El archivo privado no está disponible en este servidor',true);}
    if(bytes.length!==certificate.size_bytes||createHash('sha256').update(bytes).digest('hex')!==certificate.sha256)throw new AppError(503,'CERTIFICATE_FILE_UNAVAILABLE','No se pudo verificar el archivo privado',true);
    return {bytes,certificate};
  }
}
