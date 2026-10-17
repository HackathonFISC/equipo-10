import { runAssessmentVertex } from '../apps/api/src/modules/training-assessments/assessment-agent.service';
const source={course_version_id:'c0000000-0000-4000-a000-000000000009',catalog_version_id:'c1000000-0000-4000-a000-000000000009',
  syllabus_text:'Registro de inventario: cada entrada aumenta las existencias y cada salida las reduce. El saldo final es saldo inicial más entradas menos salidas. Verificar documentos de entrada y salida antes de registrar el movimiento.',
  outcomes:[{competency_id:'c2000000-0000-4000-a000-000000000009',name:'Registro de inventario',description:'Calcular saldo y registrar entradas y salidas con respaldo documental.'}],
};
const result=await runAssessmentVertex(source);
if(result.course_version_id!==source.course_version_id||result.catalog_version_id!==source.catalog_version_id||result.questions.some(q=>!source.syllabus_text.includes(q.quote)||q.competency_id!==source.outcomes[0].competency_id))throw new Error('LIVE_BANK_SOURCE_VALIDATION_FAILED');
console.info(JSON.stringify({verified:true,provider:'vertex',synthetic:true,questions:result.questions.length,scope:'HUMAN_REVIEW_REQUIRED'}));
