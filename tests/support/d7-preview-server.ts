// Synthetic D7 preview only. This resets the dedicated D7 database on 55445.
import { randomUUID } from 'node:crypto';
import { setupTestDatabase } from './training-center-database-fixture';
import { startAuthFixture } from './auth-fixture';
import { createApp } from '../../apps/api/src/app';
import { IdentityService } from '../../apps/api/src/modules/identity/identity.service';
import { CoursesService } from '../../apps/api/src/modules/courses/courses.service';
import { TrainingCenterService } from '../../apps/api/src/modules/training-center/training-center.service';
import { TrainingParticipantsService } from '../../apps/api/src/modules/training-participants/training-participants.service';
import { createVerifyToken } from '../../apps/api/src/security/auth';
import { TrainingAssessmentsService } from '../../apps/api/src/modules/training-assessments/training-assessments.service';
import { TrainingCertificatesService } from '../../apps/api/src/modules/training-certificates/training-certificates.service';
import { ProfileService } from '../../apps/api/src/modules/profile/profile.service';
import { seedConfirmedD7Profile } from './d7-confirmed-profile';
import { AgentA01Service } from '../../apps/api/src/modules/recruitment/agent-a01.service';
import { RecruitmentService } from '../../apps/api/src/modules/recruitment/recruitment.service';
import { ApplicationsService } from '../../apps/api/src/modules/recruitment/applications.service';
import { OpportunitiesService } from '../../apps/api/src/modules/opportunities/opportunities.service';
import { ReservationsService } from '../../apps/api/src/modules/reservations/reservations.service';

const fixture = await setupTestDatabase();
const auth = startAuthFixture(55448, ['http://127.0.0.1:5177']);
const config = {...fixture.config, supabaseUrl: auth.url};
const user = await fixture.db.resolveAuthSubject(auth.users.b.id, true);
const org = randomUUID(), catalog = randomUUID(), skill = randomUUID();
await fixture.admin.query('INSERT INTO app."Organization" (id,name,type,"updatedAt") VALUES ($1,$2,\'TRAINING_CENTER\',NOW())', [org,'Centro D7 DEMO']);
await fixture.admin.query('INSERT INTO app."OrganizationMembership" (id,"userId","organizationId",role,"updatedAt") VALUES ($1,$2,$3,\'TRAINING_MANAGER\',NOW())',[randomUUID(),user,org]);
await fixture.admin.query('INSERT INTO app."CatalogVersion" (id,code,"sourceLabel") VALUES ($1,\'D7-PREVIEW\',\'Synthetic preview\')',[catalog]);
await fixture.admin.query('INSERT INTO app."CompetencyEntry" (id,"catalogVersionId",code,name,description,kind) VALUES ($1,$2,\'D7-INV\',\'Registro de inventario\',\'Registrar existencias\',\'SKILL\')',[skill,catalog]);
const recruiter=await fixture.db.resolveAuthSubject(auth.users.c.id,true),company=randomUUID(),occupation=randomUUID();
await fixture.admin.query('INSERT INTO app."Organization"(id,name,type,"updatedAt") VALUES($1,\'Empresa integración DEMO\',\'COMPANY\',NOW())',[company]);
await fixture.admin.query('INSERT INTO app."OrganizationMembership"(id,"userId","organizationId",role,"updatedAt") VALUES($1,$2,$3,\'RECRUITER\',NOW())',[randomUUID(),recruiter,company]);
await fixture.admin.query('INSERT INTO app."OccupationEntry"(id,"catalogVersionId",code,name,description) VALUES($1,$2,\'DEMO-INV\',\'Auxiliar de inventario\',\'Registrar entradas y salidas\')',[occupation,catalog]);
const recruitment=new RecruitmentService(fixture.db,new AgentA01Service(fixture.db,async()=>({
  catalog_version_id:catalog,title:'Auxiliar de inventario DEMO',occupation_id:occupation,occupation_name:'Auxiliar de inventario',
  proposed_requirements:[{competency_id:skill,competency_name:'Registro de inventario',competency_code:'D7-INV',requirement_type:'ESSENTIAL',stage:'ENTRY',description:'Registrar entradas y salidas'}],
  clarification_questions:[],discriminatory_warnings:[],has_blocking_issues:false,provider:'synthetic-preview',
})));
const candidateIdentity={id:auth.users.a.id,email:auth.users.a.email};
const candidateProfile=await seedConfirmedD7Profile(fixture.db,candidateIdentity);
const centerIdentity={id:auth.users.b.id,email:auth.users.b.email};
const seedCenter=new TrainingCenterService(fixture.db);
const seedCourse=await seedCenter.create(centerIdentity,org,{code:'D7-PAST',title:'Inventario: curso realizado DEMO',description:'Datos sintéticos para revisar participantes y certificados.'},randomUUID());
const published=await seedCenter.publish(centerIdentity,org,seedCourse.id,{
  expected_updated_at:seedCourse.updated_at,syllabus_text:'Curso de registro de inventario. Las entradas aumentan las existencias y las salidas las reducen.',catalog_version_id:catalog,
  outcomes:[{competency_id:skill,description:'Registrar entradas y salidas',quote:'registro de inventario'}],prerequisites:[],confirm:true,
  edition:{modality:'REMOTE',location:'Aula DEMO',start_date:'2026-10-01',end_date:'2026-10-14',total_slots:10,cost_amount:0,cost_currency:'USD',cost_period:'TOTAL',sessions:[{weekday:1,start_minute:540,end_minute:600,timezone:'America/Panama'}]},
},randomUUID());
await fixture.admin.query('INSERT INTO app."CourseReservation"(id,"profileId","editionId","reservationNumber","updatedAt") VALUES($1,$2,$3,\'D7-PREVIEW-RESERVA\',NOW())',[randomUUID(),candidateProfile.id,published.edition_id]);
const app = createApp({
  identityService: new IdentityService(fixture.db), coursesService: new CoursesService(fixture.db),
  profileService:new ProfileService(fixture.db),
  opportunitiesService:new OpportunitiesService(fixture.db),
  reservationsService:new ReservationsService(fixture.db),
  recruitmentService:recruitment,applicationsService:new ApplicationsService(fixture.db),
  trainingAssessmentsService:new TrainingAssessmentsService(fixture.db,async source=>{
    const good=randomUUID(),bad=randomUUID();
    return {course_version_id:source.course_version_id,catalog_version_id:source.catalog_version_id,questions:[{
      id:randomUUID(),prompt:'¿Qué ocurre con las existencias al registrar una entrada?',options:[{id:good,text:'Aumentan'},{id:bad,text:'Disminuyen'}],correct_option_id:good,
      rationale:'Una entrada aumenta las existencias; esta respuesta solo verifica el ejercicio.',quote:source.syllabus_text.includes('registro de inventario')?'registro de inventario':source.syllabus_text,competency_id:source.outcomes[0]!.competency_id,
    }]};
  }),
  trainingCertificatesService:new TrainingCertificatesService(fixture.db),
  trainingCenterService: new TrainingCenterService(fixture.db, async input => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {provider:'vertex',catalog_version_id:catalog,questions:[],proposals:[{
      competency_id:skill,name:'Registro de inventario',description:'Registrar existencias',
      quote:input.request.syllabus_text.includes('registro de inventario') ? 'registro de inventario' : input.request.syllabus_text,
      is_prerequisite:false,
    }]};
  }),
  trainingParticipantsService: new TrainingParticipantsService(fixture.db),
  verifyToken:createVerifyToken(config),allowedOrigins:config.allowedOrigins,
});
const server = Bun.serve({hostname:'127.0.0.1',port:55447,fetch:app.fetch});
console.info('D7 synthetic preview ready on 55447; injected A01/A02, NO live Vertex; reserved demo participant preseeded');
for (const signal of ['SIGTERM','SIGINT'] as const) process.on(signal, async () => {
  server.stop(true); auth.stop(); await fixture.close(); process.exit(0);
});
