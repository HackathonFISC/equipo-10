import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../app';
import { AppError } from '../../errors';
import type { TrainingCertificatesService } from './training-certificates.service';
const id=(s:string)=>{if(!z.string().uuid().safeParse(s).success)throw new AppError(400,'INVALID_ID','Identificador no válido');return s;};
export function createTrainingCertificatesController(service:TrainingCertificatesService){
  const router=new Hono<AppEnv>();
  router.post('/organizations/:organizationId/training-completions/:completionId/certificate',async c=>{
    const size=Number(c.req.header('Content-Length')??0);
    if(size>5*1024*1024+65536)throw new AppError(413,'CERTIFICATE_TOO_LARGE','El PDF debe pesar como máximo 5 MB');
    let form:FormData;try{form=await c.req.formData();}catch{throw new AppError(400,'INVALID_FORM','Archivo no válido');}
    const file=form.get('file');if(!(file instanceof File))throw new AppError(400,'FILE_REQUIRED','Selecciona el certificado PDF');
    const result=await service.upload(c.get('identity'),id(c.req.param('organizationId')),id(c.req.param('completionId')),file,c.req.header('Idempotency-Key'));
    return c.json({data:result,request_id:c.get('requestId')},result.isReplay?200:201);
  });
  router.get('/training-certificates/:certificateId/download',async c=>{
    const {bytes,certificate}=await service.download(c.get('identity'),id(c.req.param('certificateId')));
    return c.body(new Uint8Array(bytes),200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="certificado.pdf"; filename*=UTF-8''${encodeURIComponent(certificate.original_filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Length':String(bytes.length)});
  });
  return router;
}
