// Isolated PostgreSQL/WASM database. Never reads .env or a connection URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
const { PGlite } = modulePath
  ? await import(pathToFileURL(resolve(modulePath)).href)
  : await import('@electric-sql/pglite');
const sqlFile = process.argv[3] || 'prisma/migrations/202610160001_profile/migration.sql';
assert(existsSync(sqlFile), 'Prepared migration required');
const db = new PGlite();
const results = [];
let failed = false;
const uid = () => randomUUID();
const digest = 'a'.repeat(64);
const a = { user: uid(), profile: uid(), revision: uid(), experience: uid(), exception: uid(), interval: uid() };
const b = { user: uid(), profile: uid(), revision: uid() };
async function test(name, action) {
  await action(); results.push({ name, status: 'passed' });
  console.log(JSON.stringify(results.at(-1)));
}
async function fails(code, action) {
  await assert.rejects(db.transaction(action), (error) => error.code === code);
}
async function createActor(x) {
  await db.query('INSERT INTO app."AppUser" (id,"authSubject","updatedAt") VALUES ($1,$2,now())', [x.user, uid()]);
  await db.query('INSERT INTO app."CandidateProfile" (id,"ownerUserId") VALUES ($1,$2)', [x.profile, x.user]);
  await db.query('INSERT INTO app."ProfileRevision" (id,"profileId","displayName","updatedAt") VALUES ($1,$2,$3,now())', [x.revision, x.profile, 'Joven de prueba']);
}
async function prepareReview(x, revision = 1, previewRevision = revision, partial = true) {
  const sections = ['ACCOUNT','EXPERIENCE','TRAINING','INTERESTS','COMPETENCIES','AVAILABILITY','CONSTRAINTS','FINAL_REVIEW'];
  for (const section of sections) {
    await db.query('INSERT INTO app."SectionReview" (id,"revisionId",section,decision,"contentRevision","actorUserId") VALUES ($1,$2,$3,$4,$5,$6)', [uid(), x.revision, section, 'REVIEWED', revision, x.user]);
  }
  x.preview = uid();
  await db.query('INSERT INTO app."ProfilePreview" (id,"revisionId","draftRevision","snapshotDigest","acknowledgePartialRequired","expiresAt") VALUES ($1,$2,$3,$4,$5,now()+interval \'15 minutes\')', [x.preview,x.revision,previewRevision,digest,partial]);
}
async function confirm(tx, x, { acknowledge = true, pointer = true, audit = true, alterContent = false } = {}) {
  const operation = uid();
  await tx.query('INSERT INTO app."OperationReceipt" (id,"actorUserId","profileId",operation,"idempotencyKey","payloadHash","receiptPayload") VALUES ($1,$2,$3,\'CONFIRM_PROFILE\',$4,$5,$6)', [operation,x.user,x.profile,uid(),digest,JSON.stringify({ effect_status: 'confirmed', version_ref: x.revision })]);
  await tx.query('INSERT INTO app."ProfileConfirmation" (id,"revisionId","previewId","operationId","actorUserId","acknowledgedPartial") VALUES ($1,$2,$3,$4,$5,$6)', [uid(),x.revision,x.preview,operation,x.user,acknowledge]);
  if (audit) await tx.query('INSERT INTO app."AuditEvent" (id,"actorUserId","profileId","revisionId","operationId","caseId",event,"reasonCode") VALUES ($1,$2,$3,$4,$5,\'test-case\',\'PROFILE_CONFIRMED\',\'USER_CONFIRMED\')', [uid(),x.user,x.profile,x.revision,operation]);
  await tx.query(`UPDATE app."ProfileRevision" SET status='CONFIRMED',revision=revision+1,"versionNumber"=1,"confirmedAt"=(SELECT "confirmedAt" FROM app."ProfileConfirmation" WHERE "revisionId"=$1),"confirmedById"=$2,"snapshotDigest"=$3${alterContent ? ',"displayName"=\'Unreviewed change\'' : ''} WHERE id=$1`, [x.revision,x.user,digest]);
  if (pointer) await tx.query('UPDATE app."CandidateProfile" SET "currentVersionId"=$1 WHERE id=$2', [x.revision,x.profile]);
}

try {
  await test('migration applies to a fresh isolated database', async () => { await db.exec(readFileSync(sqlFile,'utf8')); });
  await createActor(a); await createActor(b);
  await test('only one active draft per candidate', () => fails('23505', tx => tx.query('INSERT INTO app."ProfileRevision" (id,"profileId","updatedAt") VALUES ($1,$2,now())', [uid(),a.profile])));
  await test('auth identity cannot be reassigned', () => fails('23514', tx => tx.query('UPDATE app."AppUser" SET "authSubject"=$1 WHERE id=$2', [uid(),a.user])));
  await test('negative money and unknown with value are rejected', async () => {
    await fails('23514',tx=>tx.query('INSERT INTO app."ProfileConstraints" (id,"profileId","revisionId","salaryState","minimumSalary","salaryCurrency","salaryPeriod") VALUES ($1,$2,$3,\'KNOWN\',-1,\'USD\',\'MONTH\')',[uid(),a.profile,a.revision]));
    await fails('23514',tx=>tx.query('INSERT INTO app."ProfileConstraints" (id,"profileId","revisionId","minimumSalary") VALUES ($1,$2,$3,0)',[uid(),a.profile,a.revision]));
  });
  await test('null mobility array cannot bypass known/unknown validation',()=>fails('23502',tx=>tx.query('INSERT INTO app."ProfileConstraints" (id,"profileId","revisionId","mobilityModes") VALUES ($1,$2,$3,NULL)',[uid(),a.profile,a.revision])));
  await test('confirmed zero is distinct from unknown and maximum decimal fits', async()=>{
    await db.query('INSERT INTO app."ProfileConstraints" (id,"profileId","revisionId","salaryState","minimumSalary","salaryCurrency","salaryPeriod","availabilityState") VALUES ($1,$2,$3,\'KNOWN\',0,\'USD\',\'MONTH\',\'KNOWN\')',[uid(),a.profile,a.revision]);
    await db.transaction(async tx=>{await tx.query('UPDATE app."ProfileConstraints" SET "minimumSalary"=999999999999.99 WHERE "revisionId"=$1',[a.revision]);const r=await tx.query('SELECT "minimumSalary"::text AS amount FROM app."ProfileConstraints" WHERE "revisionId"=$1',[a.revision]);assert.equal(r.rows[0].amount,'999999999999.99');});
  });
  const sourceA=uid(),sourceB=uid(),fragmentA=uid();
  for(const [source,x] of [[sourceA,a],[sourceB,b]]) await db.query('INSERT INTO app."ProfileSource" (id,"profileId",kind,status,sha256,"mediaType","sizeBytes","manualText") VALUES ($1,$2,\'MANUAL_TEXT\',\'READY\',$3,\'text/plain\',10,\'Declaracion\')',[source,x.profile,digest]);
  await test('source fragments cannot cross owners',()=>fails('23503',tx=>tx.query('INSERT INTO app."SourceFragment" (id,"profileId","sourceId",text) VALUES ($1,$2,$3,\'Inventado\')',[uid(),a.profile,sourceB])));
  await db.query('INSERT INTO app."SourceFragment" (id,"profileId","sourceId",text) VALUES ($1,$2,$3,\'Conteo declarado\')',[fragmentA,a.profile,sourceA]);
  await test('original source content is immutable',()=>fails('23514',tx=>tx.query('UPDATE app."ProfileSource" SET "manualText"=\'Rewritten\' WHERE id=$1',[sourceA])));
  const evidenceA=uid();
  await db.query('INSERT INTO app."ProfileEvidence" (id,"profileId","fragmentId",kind,scope) VALUES ($1,$2,$3,\'SELF_REPORT\',\'Conteo declarado\')',[evidenceA,a.profile,fragmentA]);
  await db.query('INSERT INTO app."ProfileExperience" (id,"profileId","revisionId",kind,title,description) VALUES ($1,$2,$3,\'INFORMAL\',\'Conteo familiar\',\'Contar productos\')',[a.experience,a.profile,a.revision]);
  await db.query('UPDATE app."ProfileRevision" SET "experienceStatus"=\'PROVIDED\',revision=revision+1 WHERE id=$1',[a.revision]);
  await test('evidence links cannot cross profiles',()=>fails('23503',tx=>tx.query('INSERT INTO app."ProfileEvidenceLink" (id,"profileId","revisionId","evidenceId","experienceId") VALUES ($1,$2,$3,$4,$5)',[uid(),b.profile,b.revision,evidenceA,a.experience])));
  await db.query('INSERT INTO app."ProfileEvidenceLink" (id,"profileId","revisionId","evidenceId","experienceId") VALUES ($1,$2,$3,$4,$5)',[uid(),a.profile,a.revision,evidenceA,a.experience]);
  const window=uid();
  await db.query('INSERT INTO app."AvailabilityWindow" (id,"profileId","revisionId",weekday,"startMinute","endMinute","validFrom","validTo") VALUES ($1,$2,$3,1,480,600,\'2026-10-01\',\'2026-12-31\')',[window,a.profile,a.revision]);
  await test('overlapping availability is rejected',()=>fails('23514',tx=>tx.query('INSERT INTO app."AvailabilityWindow" (id,"profileId","revisionId",weekday,"startMinute","endMinute","validFrom","validTo") VALUES ($1,$2,$3,1,590,650,\'2026-10-01\',\'2026-12-31\')',[uid(),a.profile,a.revision])));
  await test('adjacent half-open availability is allowed',()=>db.query('INSERT INTO app."AvailabilityWindow" (id,"profileId","revisionId",weekday,"startMinute","endMinute","validFrom","validTo") VALUES ($1,$2,$3,1,600,650,\'2026-10-01\',\'2026-12-31\')',[uid(),a.profile,a.revision]));
  await db.query('INSERT INTO app."AvailabilityException" (id,"profileId","revisionId",date) VALUES ($1,$2,$3,\'2026-11-01\')',[a.exception,a.profile,a.revision]);
  await db.query('INSERT INTO app."ExceptionInterval" (id,"exceptionId","startMinute","endMinute") VALUES ($1,$2,480,600)',[a.interval,a.exception]);
  await test('confirmation without receipt is rejected',()=>fails('23514',tx=>tx.query('UPDATE app."ProfileRevision" SET status=\'CONFIRMED\',revision=revision+1,"versionNumber"=1,"confirmedAt"=now(),"confirmedById"=$1,"snapshotDigest"=$2 WHERE id=$3',[a.user,digest,a.revision])));
  await prepareReview(a,2);
  await test('confirmation cannot use another candidates preview',async()=>{
    const foreignPreview=uid();
    await db.query('INSERT INTO app."ProfilePreview" (id,"revisionId","draftRevision","snapshotDigest","acknowledgePartialRequired","expiresAt") VALUES ($1,$2,2,$3,true,now()+interval \'15 minutes\')',[foreignPreview,b.revision,digest]);
    await fails('23514',tx=>confirm(tx,{...a,preview:foreignPreview}));
  });
  await test('partial profile requires acknowledgement',()=>fails('23514',tx=>confirm(tx,a,{acknowledge:false})));
  await test('confirmation cannot change previewed content',()=>fails('23514',tx=>confirm(tx,a,{alterContent:true})));
  await test('confirmation requires audit',()=>fails('23514',tx=>confirm(tx,a,{audit:false})));
  await test('confirmation without pointer rolls back at commit',()=>fails('23514',tx=>confirm(tx,a,{pointer:false})));
  await test('failed confirmation leaves no receipt or confirmation behind',async()=>{
    const r=await db.query('SELECT count(*)::int AS count FROM app."ProfileConfirmation" WHERE "revisionId"=$1',[a.revision]);assert.equal(r.rows[0].count,0);
    const receipts=await db.query('SELECT count(*)::int AS count FROM app."OperationReceipt" WHERE operation=\'CONFIRM_PROFILE\'');assert.equal(receipts.rows[0].count,0);
  });
  await test('valid atomic confirmation persists one immutable version',async()=>{
    await db.transaction(tx=>confirm(tx,a));
    const r=await db.query('SELECT status,"versionNumber" FROM app."ProfileRevision" WHERE id=$1',[a.revision]);assert.equal(r.rows[0].status,'CONFIRMED');assert.equal(r.rows[0].versionNumber,1);
  });
  await test('confirmed revision cannot be edited',()=>fails('23514',tx=>tx.query('UPDATE app."ProfileRevision" SET "displayName"=\'Otro\',revision=revision+1 WHERE id=$1',[a.revision])));
  await test('confirmed child cannot be edited or deleted',async()=>{
    await fails('23514',tx=>tx.query('UPDATE app."ProfileExperience" SET description=\'Otro\' WHERE id=$1',[a.experience]));
    await fails('23514',tx=>tx.query('DELETE FROM app."ProfileExperience" WHERE id=$1',[a.experience]));
  });
  await test('nested exception intervals are frozen too',()=>fails('23514',tx=>tx.query('UPDATE app."ExceptionInterval" SET "endMinute"=660 WHERE id=$1',[a.interval])));
  const next=uid();await db.query('INSERT INTO app."ProfileRevision" (id,"profileId","baseVersionId","updatedAt") VALUES ($1,$2,$3,now())',[next,a.profile,a.revision]);
  await test('new draft cannot silently drop its current base version',()=>fails('23514',tx=>tx.query('INSERT INTO app."ProfileRevision" (id,"profileId","updatedAt") VALUES ($1,$2,now())',[uid(),a.profile])));
  await test('moving a child OUT of a confirmed version is rejected',()=>fails('23514',tx=>tx.query('UPDATE app."ProfileExperience" SET "revisionId"=$1 WHERE id=$2',[next,a.experience])));
  await test('current version cannot point to another candidate',()=>fails('23514',tx=>tx.query('UPDATE app."CandidateProfile" SET "currentVersionId"=$1 WHERE id=$2',[a.revision,b.profile])));
  await prepareReview(b,1);
  await db.query('UPDATE app."ProfileRevision" SET revision=revision+1 WHERE id=$1',[b.revision]);
  await test('old preview cannot confirm a newer draft revision',()=>fails('23514',tx=>confirm(tx,b)));
  await db.query('UPDATE app."SectionReview" SET "contentRevision"=2 WHERE "revisionId"=$1',[b.revision]);
  b.preview=uid();
  await db.query('INSERT INTO app."ProfilePreview" (id,"revisionId","draftRevision","snapshotDigest","acknowledgePartialRequired","createdAt","expiresAt") VALUES ($1,$2,2,$3,true,now()-interval \'15 minutes\',now()-interval \'1 minute\')',[b.preview,b.revision,digest]);
  await test('expired preview cannot confirm even with current revision',()=>fails('23514',tx=>confirm(tx,b)));
  await test('idempotency key is unique per actor and operation',async()=>{
    const insert=(tx)=>tx.query('INSERT INTO app."OperationReceipt" (id,"actorUserId",operation,"idempotencyKey","payloadHash","receiptPayload") VALUES ($1,$2,\'DRAFT\',\'same-key-123456789\',$3,\'{}\')',[uid(),a.user,digest]);
    await insert(db);await fails('23505',insert);
  });
  await test('all application tables have RLS enabled',async()=>{
    const r=await db.query('SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=\'app\' AND c.relkind=\'r\' AND NOT c.relrowsecurity');assert.equal(r.rows[0].count,0);
  });
  await test('non-owner role has no row access even after SELECT grant',async()=>{
    await db.exec('CREATE ROLE schema_probe; GRANT USAGE ON SCHEMA app TO schema_probe; GRANT SELECT ON app."CandidateProfile" TO schema_probe; SET ROLE schema_probe;');
    try {const r=await db.query('SELECT count(*)::int AS count FROM app."CandidateProfile"');assert.equal(r.rows[0].count,0);} finally {await db.exec('RESET ROLE');}
  });
  console.log(JSON.stringify({ result:'passed',tests:results.length,engine:'isolated PostgreSQL via PGlite',remote_database_used:false }));
} catch (error) {
  failed = true;
  console.error(JSON.stringify({ result: 'failed', completed_tests: results.length, code: error.code, message: String(error.message).slice(0, 600) }));
  process.exitCode = 1;
} finally {
  await db.close();
  if (failed) process.exitCode = 1;
}
