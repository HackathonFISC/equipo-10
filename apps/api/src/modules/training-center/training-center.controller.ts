import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../app";
import { AppError } from "../../errors";
import { TrainingCourseDraftSchema,TrainingCoursePublicationSchema,SyllabusInterpretRequestSchema } from "../../../../../packages/contracts/src/training-center";
import { TrainingCenterService } from "./training-center.service";
import { TrainingCourseWorkspaceSchema } from '@equipo10/contracts';

const id=z.string().uuid();
function identifier(value:string){if(!id.safeParse(value).success)throw new AppError(400,"INVALID_ID","Identificador inválido");return value;}
async function body<T>(request:{json:()=>Promise<unknown>},schema:z.ZodType<T>):Promise<T>{
  let raw:unknown;try{raw=await request.json();}catch{throw new AppError(400,"INVALID_JSON","Cuerpo JSON inválido");}
  const result=schema.safeParse(raw);
  if(!result.success)throw new AppError(422,"INVALID_REQUEST","Revisa los datos del curso",false,result.error.issues.map(i=>({field:i.path.join("."),message:i.message})));
  return result.data;
}
export function createTrainingCenterController(service:TrainingCenterService):Hono<AppEnv>{
  const router=new Hono<AppEnv>();
  const base="/organizations/:organizationId/training-courses";
  router.get(base,async c=>c.json({data:await service.list(c.get("identity"),identifier(c.req.param("organizationId"))),request_id:c.get("requestId")}));
  router.post(base,async c=>c.json({data:await service.create(c.get("identity"),identifier(c.req.param("organizationId")),await body(c.req,TrainingCourseDraftSchema),c.req.header("Idempotency-Key")??""),request_id:c.get("requestId")},201));
  router.get(`${base}/:courseId`,async c=>c.json({data:await service.detail(c.get("identity"),identifier(c.req.param("organizationId")),identifier(c.req.param("courseId"))),request_id:c.get("requestId")}));
  router.post(`${base}/:courseId/interpret`,async c=>c.json({data:await service.interpret(c.get("identity"),identifier(c.req.param("organizationId")),identifier(c.req.param("courseId")),await body(c.req,SyllabusInterpretRequestSchema)),request_id:c.get("requestId")}));
  router.post(`${base}/:courseId/publications`,async c=>c.json({data:await service.publish(c.get("identity"),identifier(c.req.param("organizationId")),identifier(c.req.param("courseId")),await body(c.req,TrainingCoursePublicationSchema),c.req.header("Idempotency-Key")??""),request_id:c.get("requestId")},201));
  router.patch(`${base}/:courseId/workspace`,async c=>c.json({data:await service.saveWorkspace(c.get('identity'),identifier(c.req.param('organizationId')),identifier(c.req.param('courseId')),await body(c.req,TrainingCourseWorkspaceSchema),c.req.header('Idempotency-Key')??''),request_id:c.get('requestId')}));
  return router;
}
