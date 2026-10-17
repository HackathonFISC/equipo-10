import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const root=process.cwd();assert(fs.existsSync('prisma/schema.prisma'));const cases=JSON.parse(fs.readFileSync('evals/manifest.json'));const out='evals/evidencia';fs.mkdirSync(out,{recursive:true});
const env={...process.env,FORCE_COLOR:'0',NO_COLOR:'1',VERTEX_DISABLED:'true'};
for(const k of Object.keys(env))if(/^(DATABASE_URL|DIRECT_URL|TEST_DATABASE_URL|TEST_DIRECT_URL|SUPABASE_|VITE_|RUN_VERTEX)/.test(k))delete env[k];
const xmlDecode=s=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const suites=[];const tests=[];
for(const name of [...new Set(cases.map(c=>c.suite))]){
 const file='tests/api/'+name+'.test.ts',junit=out+'/'+name+'.xml',args=['--no-env-file','test',file,'--reporter=junit','--reporter-outfile='+junit];
 if(name==='d2-pdf-a02-verification')args.push('--test-name-pattern','Escenario [1-8]:');
 if(name==='a01-draft-live')args.push('--test-name-pattern','Detécta sesgos deterministas');
 console.log('Evaluando '+name);
 const suiteEnv={...env};if(name==='a05-regression')suiteEnv.VERTEX_DISABLED='false';
 const start=Date.now();const res=spawnSync(process.versions.bun ? process.execPath : (process.env.BUN_EXECUTABLE || 'bun'),args,{cwd:root,env:suiteEnv,encoding:'utf8',timeout:180000,maxBuffer:8000000,windowsHide:true});
 const log=(res.stdout||'')+'\n'+(res.stderr||'');assert(!/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@(?!127\.0\.0\.1|localhost)/i.test(log),'Possible remote credential output');fs.writeFileSync(out+'/'+name+'.log',log);
 const xml=fs.existsSync(junit)?fs.readFileSync(junit,'utf8'):'';
 const casesXml=[...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(m=>({suite:name,name:xmlDecode((m[1].match(/\bname="([^"]*)"/)||[])[1]||''),status:/<(failure|error)\b/.test(m[2]||'')?'FAIL':/<skipped\b/.test(m[2]||'')?'SKIPPED':'PASS'}));
 tests.push(...casesXml);suites.push({suite:name,command:['bun',...args].join(' '),exit_code:res.status,infrastructure_error:res.error?.code||null,duration_ms:Date.now()-start,passed:casesXml.filter(t=>t.status==='PASS').length,failed:casesXml.filter(t=>t.status==='FAIL').length,skipped:casesXml.filter(t=>t.status==='SKIPPED').length,log:out+'/'+name+'.log',junit});
 console.log(JSON.stringify(suites.at(-1)));
}
const results=cases.map(c=>{const matched=tests.filter(t=>t.suite===c.suite&&t.name.includes(c.match));const suite=suites.find(s=>s.suite===c.suite);return {...c,status:matched.length>0&&matched.every(t=>t.status==='PASS')&&suite.exit_code===0?'PASS':'FAIL',observed:{matched_tests:matched.length,passed:matched.filter(t=>t.status==='PASS').length,failed:matched.filter(t=>t.status==='FAIL').length,suite_exit:suite.exit_code},evidence:[suite.log,suite.junit],test_names:matched.map(t=>t.name)};});
const files=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).stdout.split('\0').filter(f=>/^(apps|packages|prisma|scripts|tests)\//.test(f)).sort();const fingerprint=crypto.createHash('sha256');for(const f of files){fingerprint.update(f+'\0');fingerprint.update(fs.readFileSync(f));}
const report={generated_at:new Date().toISOString(),source_commit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),evaluated_files_sha256:fingerprint.digest('hex'),fingerprint_files:files.length,provider:'offline: no live model invocation; explicit mocks/injected runners where indicated',databases:['127.0.0.1:55435/equipo10_d1_test','127.0.0.1:55445/aimpulsa_d7_test'],summary:{evals:results.length,passed:results.filter(c=>c.status==='PASS').length,failed:results.filter(c=>c.status==='FAIL').length,tests_passed:tests.filter(t=>t.status==='PASS').length,tests_failed:tests.filter(t=>t.status==='FAIL').length},suites,cases:results,not_proven:['Full correlated three-agent live case','Full manual UI acceptance with real accounts','Semantic correctness or adversarial robustness of all real-model outputs','Global optimal job assignment','Video/administrative deadline compliance']};
fs.writeFileSync('evals/resultados.json',JSON.stringify(report,null,2)+'\n');
const quote=s=>'"'+String(s).replaceAll('"','""')+'"';const header=['id','requisitos','caso','entrada_por_crear','esperado','metrica','umbral_propuesto','estado','resultado_real','evidencia'];
const rows=results.map(c=>[c.id,'ver manifest/resultados',c.name,c.fixture,c.expected,c.metric,'100% de aserciones del caso; suite sin fallos',c.status,JSON.stringify(c.observed),c.evidence.join('; ')].map(quote).join(','));
fs.writeFileSync('evals/casos.csv',header.join(',')+'\n'+rows.join('\n')+'\n');
console.log(JSON.stringify(report.summary));if(report.summary.failed||suites.some(s=>s.exit_code!==0))process.exitCode=1;
