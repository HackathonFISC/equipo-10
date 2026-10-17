import {Hono} from "hono";
import {z} from "zod";
import type {AppEnv} from "../../app";
import {AppError} from "../../errors";
import {AssessmentConsentSchema,AssessmentBankConfirmationSchema,AssessmentStartSchema,AssessmentSubmissionSchema,AssessmentAssociationSchema} from "@equipo10/contracts";
import {TrainingAssessmentsService} from "./training-assessments.service";
function id(value:string){if(!z.string().uuid().safeParse(value).success)throw new AppError(400,"INVALID_ID","Identificador inválido");return value;}
async function parse<T>(req:{json:()=>Promise<unknown>},schema:z.ZodType<T>){let value;try{value=await req.json();}catch{throw new AppError(400,"INVALID_JSON","JSON inválido");}const r=schema.safeParse(value);if(!r.success)throw new AppError(422,"INVALID_REQUEST","Revisa los datos",false,r.error.issues.map(i=>({field:i.path.join("."),message:i.message})));return r.data;}
export function createTrainingAssessmentsController(service:TrainingAssessmentsService){
 const router=new Hono<AppEnv>(),center="/organizations/:organizationId/training-courses/:courseId/banks",attempt="/me/training-assessment-attempts/:attemptId";
 router.get(center,async c=>c.json({data:await service.banks(c.get("identity"),id(c.req.param("organizationId")),id(c.req.param("courseId"))),request_id:c.get("requestId")}));
 router.post(`${center}/proposals`,async c=>{const b=await parse(c.req,AssessmentConsentSchema);return c.json({data:await service.propose(c.get("identity"),id(c.req.param("organizationId")),id(c.req.param("courseId")),b.consent),request_id:c.get("requestId")});});
 router.post(center,async c=>c.json({data:await service.confirmBank(c.get("identity"),id(c.req.param("organizationId")),id(c.req.param("courseId")),await parse(c.req,AssessmentBankConfirmationSchema),c.req.header("Idempotency-Key")??""),request_id:c.get("requestId")},201));
 router.get("/courses/:courseId/assessment-bank",async c=>c.json({data:await service.metadata(c.get("identity"),id(c.req.param("courseId"))),request_id:c.get("requestId")}));
 router.get("/courses/:courseId/assessment-attempts",async c=>c.json({data:await service.listAttempts(c.get("identity"),id(c.req.param("courseId"))),request_id:c.get("requestId")}));
 router.post("/courses/:courseId/assessment-attempts",async c=>c.json({data:await service.start(c.get("identity"),id(c.req.param("courseId")),await parse(c.req,AssessmentStartSchema),c.req.header("Idempotency-Key")??""),request_id:c.get("requestId")},201));
 router.get(attempt,async c=>c.json({data:await service.getAttempt(c.get("identity"),id(c.req.param("attemptId"))),request_id:c.get("requestId")}));
 router.post(`${attempt}/submissions`,async c=>c.json({data:await service.submit(c.get("identity"),id(c.req.param("attemptId")),await parse(c.req,AssessmentSubmissionSchema),c.req.header("Idempotency-Key")??""),request_id:c.get("requestId")}));
 router.post(`${attempt}/associations`,async c=>{const b=await parse(c.req,AssessmentAssociationSchema);return c.json({data:await service.associate(c.get("identity"),id(c.req.param("attemptId")),b.confirm,c.req.header("Idempotency-Key")??""),request_id:c.get("requestId")});});
 return router;
}
