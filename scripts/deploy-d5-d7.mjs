import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
import {validateDestinationConfig,sanitizeUrlForPg} from './deploy-db.mjs';

export const migrationNames=[
  '202610170003_applications_and_recruitment','202610170004_training_center_access',
  '202610170005_training_completion','202610170006_training_workspace',
  '202610170007_training_assessments','202610170008_training_certificate','202610170009_company_scope',
];
const newTables=['OpportunityDraft','CandidateApplication','TrainingCompletion','TrainingCourseWorkspace','TrainingAssessmentBank','TrainingAssessmentAttempt','TrainingAssessmentAssociation','TrainingCertificate'];
const tablesByMigration={
  '202610170003_applications_and_recruitment':['OpportunityDraft','CandidateApplication'],
  '202610170005_training_completion':['TrainingCompletion'],
  '202610170006_training_workspace':['TrainingCourseWorkspace'],
  '202610170007_training_assessments':['TrainingAssessmentBank','TrainingAssessmentAttempt','TrainingAssessmentAssociation'],
  '202610170008_training_certificate':['TrainingCertificate'],
};
export function migrationBody(sql){
  return sql.replace(/^\s*BEGIN;\s*/i,'').replace(/COMMIT;\s*$/i,'');
}
export function assertCleanMigration(record,checksum,name){
  if(record&&(!record.finished_at||record.rolled_back_at||record.checksum!==checksum))throw new Error(`migration_not_clean:${name}`);
}
export async function deploy(mode='--check'){
  if(!['--check','--apply','--verify'].includes(mode))throw new Error('invalid_mode');
  validateDestinationConfig({supabaseUrl:process.env.SUPABASE_URL,directUrl:process.env.DIRECT_URL,databaseUrl:process.env.DATABASE_URL});
  const tls={ca:fs.readFileSync(process.env.DATABASE_SSL_CA_FILE||'certs/supabase-prod-ca-2021.crt','utf8'),rejectUnauthorized:true};
  const client=new pg.Client({connectionString:sanitizeUrlForPg(process.env.DIRECT_URL),ssl:tls,connectionTimeoutMillis:8000,query_timeout:30000});
  const files=migrationNames.map(name=>{const sql=fs.readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8');return {name,sql,checksum:crypto.createHash('sha256').update(sql).digest('hex')};});
  let open=false;
  try{
    await client.connect();await client.query(mode==='--apply'?'BEGIN':'BEGIN READ ONLY');open=true;
    if(mode==='--apply')await client.query("SELECT pg_advisory_xact_lock(hashtextextended('aimpulsa:deployment',0))");
    const ledger=(await client.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations')).rows;
    for(const base of ['202610160001_profile','202610160002_identity','202610170001_opportunities','202610170002_courses_and_reservations']){
      if(!ledger.some(r=>r.migration_name===base&&r.finished_at&&!r.rolled_back_at))throw new Error(`base_migration_missing:${base}`);
    }
    const existing=(await client.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname=ANY($1)",[newTables])).rows;
    const pending=[];
    for(const f of files){
      const record=ledger.find(r=>r.migration_name===f.name&&!r.rolled_back_at);
      assertCleanMigration(record,f.checksum,f.name);
      const owned=tablesByMigration[f.name]??[];
      if(!record&&owned.some(t=>existing.some(r=>r.relname===t)))throw new Error(`unrecorded_schema_requires_review:${f.name}`);
      if(record&&owned.some(t=>!existing.some(r=>r.relname===t&&r.relrowsecurity)))throw new Error(`recorded_schema_incomplete:${f.name}`);
      if(!record)pending.push(f);
    }
    const countTables=['CandidateProfile','ProfileRevision','Opportunity','Course','CourseReservation',...existing.map(r=>r.relname)];
    const counts=async()=>{
      const result={};for(const t of countTables)result[t]=(await client.query(`SELECT count(*)::text AS n FROM app."${t}"`)).rows[0].n;return result;
    };
    const before=await counts();
    if(mode==='--verify'&&pending.length)throw new Error('pending_migrations');
    if(mode==='--apply')for(const f of pending){
      await client.query(migrationBody(f.sql));
      await client.query('INSERT INTO public._prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES($1,$2,$3,NOW(),NOW(),1)',[crypto.randomUUID(),f.checksum,f.name]);
    }
    if(JSON.stringify(before)!==JSON.stringify(await counts()))throw new Error('existing_business_rows_changed');
    if(mode!=='--check'||!pending.length){
      const rows=(await client.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname=ANY($1)",[newTables])).rows;
      if(rows.length!==newTables.length||rows.some(r=>!r.relrowsecurity))throw new Error('new_tables_or_rls_missing');
      const exposed=(await client.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.prosecdef AND p.proname=ANY($1) AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))",[['can_manage_training_center','training_participants','lock_training_reservation','can_read_training_completion','can_record_training_completion','own_training_completions','training_assessment_bank_metadata','start_training_assessment','can_read_training_certificate','can_attach_training_certificate','can_manage_company','company_has_consented_revision']])).rows;
      if(exposed.length)throw new Error('private_functions_exposed');
    }
    await client.query(mode==='--apply'?'COMMIT':'ROLLBACK');open=false;
    if(mode==='--verify'){
      const runtime=new pg.Client({connectionString:sanitizeUrlForPg(process.env.DATABASE_URL),ssl:tls,connectionTimeoutMillis:8000,query_timeout:15000});
      try{
        await runtime.connect();await runtime.query('BEGIN READ ONLY');await runtime.query('SET LOCAL ROLE equipo10_runtime');
        for(const t of newTables){const rows=await runtime.query(`SELECT * FROM app."${t}" LIMIT 1`);if(rows.rowCount)throw new Error(`private_rows_visible_without_actor:${t}`);}
        await runtime.query('ROLLBACK');
      }finally{await runtime.end();}
    }
    return {status:mode.slice(2)+'_success',pending:mode==='--apply'?[]:pending.map(f=>f.name),applied_now:mode==='--apply'?pending.map(f=>f.name):[],existing_business_rows_unchanged:true,runtime_verified:mode==='--verify'};
  }finally{if(open)await client.query('ROLLBACK').catch(()=>{});await client.end();}
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.info(JSON.stringify(await deploy(process.argv[2])));}catch(e){console.error(JSON.stringify({status:'failed',code:e.code??'DEPLOY_ERROR',message:String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]')}));process.exitCode=1;}
}
