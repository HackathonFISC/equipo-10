import { z } from "zod";

const Id = z.string().uuid();
const Text = z.string().trim().min(1);
export const TrainingCourseDraftSchema = z.object({
  code: Text.max(50).regex(/^[A-Za-z0-9_-]+$/),
  title: Text.max(160), description: Text.max(3000),
}).strict();
export const SyllabusInterpretRequestSchema = z.object({
  syllabus_text: Text.max(5000), answers: z.array(Text.max(1000)).max(3).default([]), consent: z.literal(true),
}).strict();
export const SyllabusProposalSchema = z.object({
  competency_id: Id, name: Text.max(160), description: Text.max(1000), quote: Text.max(1000), is_prerequisite: z.boolean(),
}).strict();
export const SyllabusInterpretationSchema = z.object({
  catalog_version_id: Id, proposals: z.array(SyllabusProposalSchema).max(30),
  questions: z.array(Text.max(500)).max(3), provider: z.literal("vertex"),
}).strict();
const MappingSchema = z.object({ competency_id: Id, description: Text.max(1000), quote: Text.max(1000) }).strict();
const SessionSchema = z.object({
  weekday: z.number().int().min(1).max(7), start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat("es", {timeZone:v}); return true; } catch { return false; } }, "Zona horaria inválida"),
  location: Text.max(200).optional(),
}).strict().refine(v => v.start_minute < v.end_minute, "Fin debe ser posterior al inicio");
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const date = new Date(`${v}T00:00:00Z`); return !isNaN(date.valueOf()) && date.toISOString().slice(0,10) === v;
}, "Fecha inválida");
export const TrainingCoursePublicationSchema = z.object({
  expected_updated_at: z.string().datetime(), syllabus_text: Text.max(5000), catalog_version_id: Id,
  outcomes: z.array(MappingSchema).min(1).max(30), prerequisites: z.array(MappingSchema).max(30),
  confirm: z.literal(true),
  edition: z.object({
    modality: z.enum(["REMOTE","ON_SITE","HYBRID"]), location: Text.max(200),
    start_date: DateOnly, end_date: DateOnly, total_slots: z.number().int().min(1).max(10000),
    cost_amount: z.number().finite().min(0).max(999999999999.99),
    cost_currency: z.string().regex(/^[A-Z]{3}$/), cost_period: z.enum(["HOUR","DAY","WEEK","MONTH","TOTAL"]),
    sessions: z.array(SessionSchema).min(1).max(30),
  }).strict(),
}).strict().superRefine((v,ctx) => {
  if(v.edition.end_date < v.edition.start_date) ctx.addIssue({code:"custom",path:["edition","end_date"],message:"Fecha final anterior al inicio"});
  const keys = new Set<string>();
  for (const [kind, items] of [["outcomes", v.outcomes],["prerequisites",v.prerequisites]] as const) {
    for(const [i,item] of items.entries()) {
      if(!v.syllabus_text.includes(item.quote)) ctx.addIssue({code:"custom",path:[kind,i,"quote"],message:"La cita debe existir literalmente en el temario"});
      const key = `${kind}:${item.competency_id}`;
      if(keys.has(key)) ctx.addIssue({code:"custom",path:[kind,i,"competency_id"],message:"Habilidad duplicada"});
      keys.add(key);
    }
  }
  for(const [i,a] of v.edition.sessions.entries()) for(const b of v.edition.sessions.slice(i+1)) {
    if(a.timezone !== b.timezone || (a.weekday===b.weekday && a.start_minute < b.end_minute && b.start_minute < a.end_minute))
      ctx.addIssue({code:"custom",path:["edition","sessions"],message:"Usar la misma zona horaria y sesiones sin solapamiento"});
  }
});
export type TrainingCourseDraft = z.infer<typeof TrainingCourseDraftSchema>;
export type TrainingCoursePublication = z.infer<typeof TrainingCoursePublicationSchema>;
export type SyllabusInterpretRequest = z.infer<typeof SyllabusInterpretRequestSchema>;
export type SyllabusInterpretation = z.infer<typeof SyllabusInterpretationSchema>;
export const TrainingCourseWorkspaceSchema = z.object({
  expected_updated_at: z.string().datetime(), syllabus_text: z.string().max(5000),
  answers: z.array(Text.max(1000)).max(3), interpretation: SyllabusInterpretationSchema.nullable(),
  chosen: z.array(z.boolean()).max(30),
}).strict().superRefine((v,ctx)=> {
  if(v.chosen.length !== (v.interpretation?.proposals.length ?? 0)) ctx.addIssue({code:'custom',path:['chosen'],message:'Revisa las propuestas guardadas'});
  if(v.interpretation?.proposals.some(p=>!v.syllabus_text.includes(p.quote))) ctx.addIssue({code:'custom',path:['interpretation'],message:'Las citas deben pertenecer al temario'});
});
export type TrainingCourseWorkspace = z.infer<typeof TrainingCourseWorkspaceSchema>;
export interface TrainingCourseSummary { id:string; code:string; title:string; description:string; active:boolean; updated_at:string; }
