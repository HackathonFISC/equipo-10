import {beforeAll,afterAll,describe,it,expect} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {setupTestDatabase} from '../support/training-center-database-fixture';
import {ApplicationsService} from '../../apps/api/src/modules/recruitment/applications.service';
import {createApp} from '../../apps/api/src/app';
import {IdentityService} from '../../apps/api/src/modules/identity/identity.service';
describe('D5/D6 consent replay and company scope safety',()=>{
 let fixture:Awaited<ReturnType<typeof setupTestDatabase>>,service:ApplicationsService;
 const candidate={id:randomUUID(),email:'candidate@example.test'},recruiter={id:randomUUID(),email:'company@example.test'},centerManager={id:randomUUID(),email:'center@example.test'};
 const company=randomUUID(),center=randomUUID(),profile=randomUUID(),revision=randomUUID(),opportunity=randomUUID(),otherOpportunity=randomUUID();
 const consentKey=randomUUID(),withdrawKey=randomUUID();
 let applicationId:string,originalReceipt:string;
 async function fails(promise:Promise<unknown>,status:number){let error:unknown;try{await promise;}catch(e){error=e;}expect(error).toMatchObject({status});}
 beforeAll(async()=>{
  fixture=await setupTestDatabase();service=new ApplicationsService(fixture.db);
  for(const actor of [candidate,recruiter,centerManager])await fixture.admin.query('INSERT INTO app."AppUser"(id,"authSubject","updatedAt") VALUES($1,$1,now())',[actor.id]);
  for(const [org,actor,type] of [[company,recruiter,'COMPANY'],[center,centerManager,'TRAINING_CENTER']] as const){
    await fixture.admin.query('INSERT INTO app."Organization"(id,name,type,"updatedAt") VALUES($1,\'Synthetic org\',$2,now())',[org,type]);
    await fixture.admin.query('INSERT INTO app."OrganizationMembership"(id,"userId","organizationId",role,"updatedAt") VALUES($1,$2,$3,\'ADMIN\',now())',[randomUUID(),actor.id,org]);
  }
  await fixture.admin.query('INSERT INTO app."CandidateProfile"(id,"ownerUserId") VALUES($1,$2)',[profile,candidate.id]);
  await fixture.admin.query('ALTER TABLE app."ProfileRevision" DISABLE TRIGGER ALL');
  try{
    await fixture.admin.query('INSERT INTO app."ProfileRevision"(id,"profileId",status,revision,"versionNumber","displayName","confirmedAt","confirmedById","snapshotDigest","updatedAt") VALUES($1,$2,\'CONFIRMED\',1,1,\'Synthetic candidate\',now(),$3,$4,now())',[revision,profile,candidate.id,'a'.repeat(64)]);
  }finally{await fixture.admin.query('ALTER TABLE app."ProfileRevision" ENABLE TRIGGER ALL');}
  await fixture.admin.query('UPDATE app."CandidateProfile" SET "currentVersionId"=$1 WHERE id=$2',[revision,profile]);
  const catalog=randomUUID(),occupation=randomUUID();
  await fixture.admin.query('INSERT INTO app."CatalogVersion"(id,code,"sourceLabel") VALUES($1,\'APPLICATION-SAFETY\',\'Synthetic\')',[catalog]);
  await fixture.admin.query('INSERT INTO app."OccupationEntry"(id,"catalogVersionId",code,name,description) VALUES($1,$2,\'SAFE\',\'Synthetic occupation\',\'Synthetic\')',[occupation,catalog]);
  for(const id of [opportunity,otherOpportunity])await fixture.admin.query('INSERT INTO app."Opportunity"(id,"organizationId",title,description,"occupationId","catalogVersionId",location,"updatedAt") VALUES($1,$2,\'Synthetic vacancy\',\'Synthetic description\',$3,$4,\'Panamá\',now())',[id,company,occupation,catalog]);
 });
 afterAll(async()=>{await fixture?.close();});
 it('original apply retry after withdrawal returns WITHDRAWN without restoring access',async()=>{
   const initial=await service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:consentKey});
   applicationId=initial.id;originalReceipt=initial.receipt_number;
   await service.withdrawApplication(candidate,applicationId,{reason:'No compartir',idempotency_key:withdrawKey});
   const replay=await service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:consentKey});
   expect(replay.status).toBe('WITHDRAWN');expect(replay.receipt_number).toBe(originalReceipt);
   const visible=await fixture.db.withActor(recruiter.id,tx=>tx.profileRevision.findMany({where:{id:revision}}));expect(visible).toHaveLength(0);
 });
 it('reactivation requires a fresh key and creates a new receipt/audit atomically',async()=>{
   await fails(service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true}),409);
   const fresh=await service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:randomUUID()});
   expect(fresh.id).toBe(applicationId);expect(fresh.status).toBe('ACTIVE');expect(fresh.receipt_number).not.toBe(originalReceipt);
   expect((await fixture.admin.query('SELECT count(*)::int n FROM app."OperationReceipt" WHERE operation=\'OPPORTUNITY_APPLICATION\'')).rows[0].n).toBe(2);
   expect((await fixture.admin.query('SELECT count(*)::int n FROM app."AuditEvent" WHERE "reasonCode"=\'NEW_EXPLICIT_CONSENT\'')).rows[0].n).toBe(1);
   const oldWithdrawal=await service.withdrawApplication(candidate,applicationId,{reason:'No compartir',idempotency_key:withdrawKey});expect(oldWithdrawal.status).toBe('ACTIVE');
 });
 it('same key different payload fails and concurrent exact apply creates one candidacy',async()=>{
   await fails(service.applyToOpportunity(candidate,otherOpportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:consentKey}),409);
   const key=randomUUID(),req={profile_revision_id:revision,consent_confirmed:true as const,idempotency_key:key};
   const [a,b]=await Promise.all([service.applyToOpportunity(candidate,otherOpportunity,req),service.applyToOpportunity(candidate,otherOpportunity,req)]);
   expect(a.id).toBe(b.id);expect(a.receipt_number).toBe(b.receipt_number);
 });
 it('active company scope denies training administrators and inactive companies at RLS',async()=>{
   const centerAllowed=await fixture.db.withActor(centerManager.id,tx=>tx.$queryRaw<{allowed:boolean}[]>`SELECT app.can_manage_company(${center}::uuid) allowed`);expect(centerAllowed[0]?.allowed).toBe(false);
   let denied=false;try{await fixture.db.withActor(centerManager.id,tx=>tx.opportunityDraft.create({data:{id:randomUUID(),organizationId:center,authorUserId:centerManager.id,rawText:'No permitir publicar empleos como centro'}}));}catch{denied=true;}expect(denied).toBe(true);
   await fixture.admin.query('UPDATE app."Organization" SET active=false WHERE id=$1',[company]);
   try{
    const allowed=await fixture.db.withActor(recruiter.id,tx=>tx.$queryRaw<{allowed:boolean}[]>`SELECT app.can_manage_company(${company}::uuid) allowed`);expect(allowed[0]?.allowed).toBe(false);
    const privateRows=await fixture.db.withActor(recruiter.id,tx=>tx.profileRevision.findMany({where:{id:revision}}));expect(privateRows).toHaveLength(0);
    await fails(service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:randomUUID()}),404);
   }finally{await fixture.admin.query('UPDATE app."Organization" SET active=true WHERE id=$1',[company]);}
 });
 it('failed audit rolls back reactivation and the same fresh key can safely retry',async()=>{
   await service.withdrawApplication(candidate,applicationId,{reason:'Pausa para prueba',idempotency_key:randomUUID()});
   const key=randomUUID();
   await fixture.admin.query(`CREATE FUNCTION app.fail_application_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='OPPORTUNITY_APPLICATION' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
     CREATE TRIGGER fail_application_audit_test BEFORE INSERT ON app."AuditEvent" FOR EACH ROW EXECUTE FUNCTION app.fail_application_audit_test();`);
   try{
     let failed=false;try{await service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:key});}catch{failed=true;}expect(failed).toBe(true);
     expect((await fixture.admin.query('SELECT status FROM app."CandidateApplication" WHERE id=$1',[applicationId])).rows[0].status).toBe('WITHDRAWN');
   }finally{await fixture.admin.query('DROP TRIGGER fail_application_audit_test ON app."AuditEvent"; DROP FUNCTION app.fail_application_audit_test()');}
   expect((await service.applyToOpportunity(candidate,opportunity,{profile_revision_id:revision,consent_confirmed:true,idempotency_key:key})).status).toBe('ACTIVE');
 });
 it('HTTP honors header idempotency and rejects header/body mismatch',async()=>{
   const app=createApp({identityService:new IdentityService(fixture.db),applicationsService:service,verifyToken:async()=>candidate,allowedOrigins:[]});
   const response=await app.request(`/api/v1/opportunities/${opportunity}/applications`,{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json','Idempotency-Key':consentKey},body:JSON.stringify({profile_revision_id:revision,consent_confirmed:true,idempotency_key:randomUUID()})});
   expect(response.status).toBe(400);expect((await response.json()).error.code).toBe('IDEMPOTENCY_KEY_MISMATCH');
 });
});
