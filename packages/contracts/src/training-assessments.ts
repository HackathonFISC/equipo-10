import {z} from "zod";
const Id=z.string().uuid(),Text=z.string().trim().min(1);
export const AssessmentQuestionSchema=z.object({id:Id,prompt:Text.max(1000),options:z.array(z.object({id:Id,text:Text.max(500)}).strict()).min(2).max(5),correct_option_id:Id,rationale:Text.max(1000),quote:Text.max(1000),competency_id:Id}).strict().superRefine((q,ctx)=>{
  if(new Set(q.options.map(o=>o.id)).size!==q.options.length || !q.options.some(o=>o.id===q.correct_option_id))ctx.addIssue({code:"custom",path:["options"],message:"Opciones únicas y respuesta correcta obligatorias"});
});
export const AssessmentBankProposalSchema=z.object({course_version_id:Id,catalog_version_id:Id,questions:z.array(AssessmentQuestionSchema).min(1).max(10)}).strict().refine(v=>new Set(v.questions.map(q=>q.id)).size===v.questions.length,"Preguntas duplicadas");
export const AssessmentBankConfirmationSchema=z.object({confirm:z.literal(true),course_version_id:Id,questions:z.array(AssessmentQuestionSchema).min(1).max(10)}).strict().refine(v=>new Set(v.questions.map(q=>q.id)).size===v.questions.length,"Preguntas duplicadas");
export const AssessmentConsentSchema=z.object({consent:z.literal(true)}).strict();
export const AssessmentStartSchema=z.object({bank_id:Id,consent:z.literal(true)}).strict();
export const AssessmentSubmissionSchema=z.object({confirm:z.literal(true),answers:z.array(z.object({question_id:Id,option_id:Id}).strict()).min(1).max(10)}).strict().refine(v=>new Set(v.answers.map(a=>a.question_id)).size===v.answers.length,"Respuesta duplicada");
export const AssessmentAssociationSchema=z.object({confirm:z.literal(true)}).strict();
export type AssessmentQuestion=z.infer<typeof AssessmentQuestionSchema>;
export type AssessmentBankProposal=z.infer<typeof AssessmentBankProposalSchema>;
export type AssessmentBankConfirmation=z.infer<typeof AssessmentBankConfirmationSchema>;
export type AssessmentSubmission=z.infer<typeof AssessmentSubmissionSchema>;
export interface AssessmentBank extends AssessmentBankProposal{id:string;created_at:string;}
export interface AssessmentResult {correct_count:number;total_count:number;scope:"EXERCISE_ONLY";items:{question_id:string;correct:boolean;feedback:string}[];}
export interface AssessmentAttemptPublic{id:string;bank_id:string;status:"STARTED"|"SUBMITTED";questions:{id:string;prompt:string;options:{id:string;text:string}[]}[];result:AssessmentResult|null;association_confirmed:boolean;}
