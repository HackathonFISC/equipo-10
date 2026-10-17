import { runSyllabusVertex } from '../apps/api/src/modules/training-center/syllabus-agent.service';
const catalog = {id:'c0000000-0000-4000-a000-000000000007',competencies:[{
  id:'c1000000-0000-4000-a000-000000000007',name:'Registro de inventario',description:'Registrar entradas y salidas de existencias.',
}]};
const result = await runSyllabusVertex({catalog,request:{consent:true,answers:[],syllabus_text:'Curso introductorio: registro de inventario. Practicar entradas y salidas de existencias con una hoja de cálculo. No se requieren conocimientos previos.'}});
if (!result.proposals.some(p=>p.competency_id===catalog.competencies[0].id && !p.is_prerequisite)) throw new Error('LIVE_MAPPING_EXPECTATION_FAILED');
console.info(JSON.stringify({verified:true,provider:result.provider,proposals:result.proposals.length,questions:result.questions.length,synthetic:true}));
