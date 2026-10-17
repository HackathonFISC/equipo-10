import {beforeAll,afterAll,describe,it,expect} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readdir,rm,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setupTestDatabase} from '../support/training-center-database-fixture';
import {TrainingCertificatesService} from '../../apps/api/src/modules/training-certificates/training-certificates.service';
import {TrainingParticipantsService} from '../../apps/api/src/modules/training-participants/training-participants.service';
import {createApp} from '../../apps/api/src/app';
import {IdentityService} from '../../apps/api/src/modules/identity/identity.service';

describe('D7 private existing certificates',()=>{
 let fixture:Awaited<ReturnType<typeof setupTestDatabase>>,dir:string,service:TrainingCertificatesService;
 const manager={id:randomUUID(),email:'manager@example.test'},candidate={id:randomUUID(),email:'candidate@example.test'},stranger={id:randomUUID(),email:'stranger@example.test'};
 const org=randomUUID(),profile=randomUUID(),course=randomUUID(),version=randomUUID(),edition=randomUUID();
 const completions=Array.from({length:4},()=>randomUUID());
 const bytes=new TextEncoder().encode('%PDF-1.7\nSynthetic existing certificate.\n%%EOF');
 const file=()=>new File([bytes],'../existing-certificate.pdf',{type:'application/pdf'});
 let certificateId:string;
 async function failure(operation:Promise<unknown>,status:number){let error:unknown;try{await operation;}catch(e){error=e;}expect(error).toMatchObject({status});}
 beforeAll(async()=>{
  fixture=await setupTestDatabase();dir=await mkdtemp(join(tmpdir(),'aimpulsa-cert-'));service=new TrainingCertificatesService(fixture.db,dir);
  for(const actor of [manager,candidate,stranger])await fixture.admin.query('INSERT INTO app."AppUser"(id,"authSubject","updatedAt") VALUES($1,$1,now())',[actor.id]);
  await fixture.admin.query('INSERT INTO app."Organization"(id,name,type,"updatedAt") VALUES($1,\'Centro sintético\',\'TRAINING_CENTER\',now())',[org]);
  await fixture.admin.query('INSERT INTO app."OrganizationMembership"(id,"userId","organizationId",role,"updatedAt") VALUES($1,$2,$3,\'TRAINING_MANAGER\',now())',[randomUUID(),manager.id,org]);
  const catalog=randomUUID();
  await fixture.admin.query('INSERT INTO app."CatalogVersion"(id,code,"sourceLabel") VALUES($1,\'CERT-TEST\',\'Synthetic\')',[catalog]);
  await fixture.admin.query('INSERT INTO app."CandidateProfile"(id,"ownerUserId") VALUES($1,$2)',[profile,candidate.id]);
  await fixture.admin.query('INSERT INTO app."Course"(id,"organizationId",code,title,description,"updatedAt") VALUES($1,$2,\'CERT\',\'Curso sintético\',\'Prueba\',now())',[course,org]);
  await fixture.admin.query('INSERT INTO app."CourseVersion"(id,"courseId","catalogVersionId","syllabusText") VALUES($1,$2,$3,\'Prueba\')',[version,course,catalog]);
  for(let i=0;i<completions.length;i++){
    const e=i?randomUUID():edition,reservation=randomUUID();
    await fixture.admin.query('INSERT INTO app."CourseEdition"(id,"courseVersionId","startDate","endDate","totalSlots","availableSlots","scheduleSummary","updatedAt") VALUES($1,$2,\'2026-10-01\',\'2026-10-14\',10,9,\'Mañana\',now())',[e,version]);
    await fixture.admin.query('INSERT INTO app."CourseReservation"(id,"profileId","editionId","reservationNumber","updatedAt") VALUES($1,$2,$3,$4,now())',[reservation,profile,e,`CERT-${i}`]);
    await fixture.admin.query('INSERT INTO app."TrainingCompletion"(id,"reservationId","organizationId","actorUserId",decision,"completedOn",reason) VALUES($1,$2,$3,$4,$5,\'2026-10-15\',\'Resultado sintético\')',[completions[i],reservation,org,manager.id,i===1?'NOT_COMPLETED':'COMPLETED']);
  }
 });
 afterAll(async()=>{await fixture?.close();if(dir)await rm(dir,{recursive:true,force:true});});
 it('uploads one existing PDF privately with sanitized metadata and no path exposure',async()=>{
   const result=await service.upload(manager,org,completions[0]!,file(),'certificate-original-key');
   certificateId=result.certificate.id;expect(result.isReplay).toBe(false);expect(result.certificate.original_filename).toBe('existing-certificate.pdf');
   expect(Object.keys(result.certificate).sort()).toEqual(['id','completion_id','original_filename','content_type','size_bytes','sha256','recorded_at'].sort());
   expect(await readdir(dir)).toEqual([`${certificateId}.pdf`]);
   const download=await service.download(candidate,certificateId);expect(download.bytes.equals(Buffer.from(bytes))).toBe(true);
   expect((await service.download(manager,certificateId)).certificate.id).toBe(certificateId);
   const own=await new TrainingParticipantsService(fixture.db).listOwnCompletions(candidate);
   expect(own.items.find(i=>i.id===completions[0])?.certificate_status).toBe('AVAILABLE');
 });
 it('HTTP upload and authenticated download preserve CORS and private/security headers',async()=>{
   const app=createApp({identityService:new IdentityService(fixture.db),trainingCertificatesService:service,
     verifyToken:async token=>token==='manager-token'?manager:candidate,allowedOrigins:['http://127.0.0.1:5177']});
   const form=new FormData();form.append('file',file());
   const upload=await app.request(`/api/v1/organizations/${org}/training-completions/${completions[0]}/certificate`,{
     method:'POST',headers:{Authorization:'Bearer manager-token',Origin:'http://127.0.0.1:5177','Idempotency-Key':'certificate-original-key'},body:form});
   expect(upload.status).toBe(200);
   expect(upload.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5177');
   const response=await app.request(`/api/v1/training-certificates/${certificateId}/download`,{headers:{Authorization:'Bearer candidate-token',Origin:'http://127.0.0.1:5177'}});
   expect(response.status).toBe(200);
   expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5177');
   expect(response.headers.get('Cache-Control')).toBe('private, no-store');
   expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
   expect(response.headers.get('Content-Disposition')).toContain('attachment;');
   expect(response.headers.get('X-Request-Id')).toBeTruthy();
   expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
 });
 it('replays exact upload, rejects changed payload and overwrite, and cleans unused files',async()=>{
   const replay=await service.upload(manager,org,completions[0]!,file(),'certificate-original-key');expect(replay.isReplay).toBe(true);expect(replay.certificate.id).toBe(certificateId);
   await failure(service.upload(manager,org,completions[0]!,new File([bytes],'other.pdf',{type:'application/pdf'}),'certificate-original-key'),409);
   await failure(service.upload(manager,org,completions[0]!,file(),'certificate-new-operation'),409);
   expect(await readdir(dir)).toEqual([`${certificateId}.pdf`]);
 });
 it('blocks foreign users, candidate upload, incomplete result and invalid PDF',async()=>{
   await failure(service.download(stranger,certificateId),404);
   await failure(service.upload(candidate,org,completions[2]!,file(),'certificate-candidate-key'),404);
   await failure(service.upload(manager,org,completions[1]!,file(),'certificate-notcompleted'),404);
   await failure(service.upload(manager,org,completions[2]!,new File(['bad'],'bad.pdf',{type:'application/pdf'}),'certificate-invalid-key'),413);
   await failure(service.upload(manager,org,completions[2]!,new File(['badmagic'],'bad.pdf',{type:'application/pdf'}),'certificate-badmagic-key'),422);
   await failure(service.upload(manager,org,completions[2]!,new File([bytes],'bad.txt',{type:'text/plain'}),'certificate-badmime-key'),422);
   await failure(service.upload(manager,org,completions[2]!,new File([new Uint8Array(5*1024*1024+1)],'huge.pdf',{type:'application/pdf'}),'certificate-oversized-key'),413);
 });
 it('rolls back DB metadata and removes file when audit insertion fails',async()=>{
   await fixture.admin.query(`CREATE FUNCTION app.fail_certificate_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='TRAINING_CERTIFICATE_ATTACHED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER fail_certificate_audit_test BEFORE INSERT ON app."AuditEvent" FOR EACH ROW EXECUTE FUNCTION app.fail_certificate_audit_test();`);
   try{let caught=false;try{await service.upload(manager,org,completions[2]!,file(),'certificate-rollback-key');}catch{caught=true;}expect(caught).toBe(true);
     expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."TrainingCertificate" WHERE "completionId"=$1',[completions[2]])).rows[0].n).toBe(0);
     expect(await readdir(dir)).toEqual([`${certificateId}.pdf`]);
   }finally{await fixture.admin.query('DROP TRIGGER fail_certificate_audit_test ON app."AuditEvent"; DROP FUNCTION app.fail_certificate_audit_test()');}
 });
 it('reports missing private file without disclosing filesystem paths',async()=>{
   const result=await service.upload(manager,org,completions[3]!,file(),'certificate-missing-file-key');
   await unlink(join(dir,`${result.certificate.id}.pdf`));
   await failure(service.download(candidate,result.certificate.id),503);
 });
 it('preserves committed file after lost commit acknowledgement and recovers via replay',async()=>{
   let lost=false;
   const uncertain=new TrainingCertificatesService({
     resolveAuthSubject:(subject,bootstrap)=>fixture.db.resolveAuthSubject(subject,bootstrap),
     async withActor(actor,fn,options){
       const result=await fixture.db.withActor(actor,fn,options);
       if(!lost&&result&&typeof result==='object'&&'certificate' in result){lost=true;throw new Error('synthetic lost commit acknowledgement');}
       return result;
     },
   },dir);
   let caught=false;try{await uncertain.upload(manager,org,completions[2]!,file(),'certificate-uncertain-key');}catch{caught=true;}expect(caught).toBe(true);
   const replay=await service.upload(manager,org,completions[2]!,file(),'certificate-uncertain-key');
   expect(replay.isReplay).toBe(true);
   expect((await service.download(candidate,replay.certificate.id)).bytes.equals(Buffer.from(bytes))).toBe(true);
 });
 it('revoked manager cannot download or replay earlier upload',async()=>{
   await fixture.admin.query('UPDATE app."OrganizationMembership" SET status=\'REVOKED\' WHERE "userId"=$1',[manager.id]);
   await failure(service.download(manager,certificateId),404);
   await failure(service.upload(manager,org,completions[0]!,file(),'certificate-original-key'),404);
 });
});
