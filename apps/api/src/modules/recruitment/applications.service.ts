import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";
import { AppError } from "../../errors";
import type { VerifiedIdentity } from "../../security/auth";
import type {
  ApplyToOpportunityRequest,
  WithdrawApplicationRequest,
  CandidateApplicationView,
} from "@equipo10/contracts";

export interface ApplicationsDb {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}
type ApplicationWithOpportunity = Prisma.CandidateApplicationGetPayload<{
  include: { opportunity: { include: { organization: { select: { name: true } } } } };
}>;

export class ApplicationsService {
  constructor(private readonly db: ApplicationsDb) {}

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  private asView(app: ApplicationWithOpportunity): CandidateApplicationView {
    return {id:app.id,opportunity_id:app.opportunityId,opportunity_title:app.opportunity.title,company_name:app.opportunity.organization.name,
      profile_revision_id:app.profileRevisionId,status:app.status,receipt_number:app.receiptNumber,consent_given_at:app.consentGivenAt.toISOString(),
      withdrawn_at:app.withdrawnAt?.toISOString()??null,withdrawal_reason:app.withdrawalReason,created_at:app.createdAt.toISOString()};
  }
  private key(value:string|undefined,fallback:string) {
    if(value!==undefined&&!/^[\x21-\x7e]{16,128}$/.test(value))throw new AppError(400,'INVALID_IDEMPOTENCY_KEY','La clave debe contener de 16 a 128 caracteres');
    return value??fallback;
  }
  private async record(tx:Prisma.TransactionClient,actor:string,profile:string,operation:string,key:string,hash:string,result:CandidateApplicationView,reason:string) {
    const receipt=await tx.operationReceipt.create({data:{actorUserId:actor,profileId:profile,operation,idempotencyKey:key,payloadHash:hash,receiptPayload:result as unknown as Prisma.InputJsonValue}});
    await tx.auditEvent.create({data:{actorUserId:actor,profileId:profile,operationId:receipt.id,caseId:'D5_D6_CANDIDATURE',event:operation,reasonCode:reason}});
  }
  async applyToOpportunity(identity:VerifiedIdentity,opportunityId:string,req:ApplyToOpportunityRequest):Promise<CandidateApplicationView> {
    if(req.consent_confirmed!==true)throw new AppError(400,'CONSENT_REQUIRED','El consentimiento explícito es obligatorio');
    const actor=await this.resolveActor(identity),key=this.key(req.idempotency_key,`application:${opportunityId}:${req.profile_revision_id}`);
    const hash=createHash('sha256').update(JSON.stringify({opportunityId,profile_revision_id:req.profile_revision_id,consent_confirmed:true})).digest('hex');
    return this.db.withActor(actor,async tx=>{
      const rows=await tx.$queryRaw<{id:string;currentVersionId:string|null}[]>`SELECT id,"currentVersionId" FROM app."CandidateProfile" WHERE "ownerUserId"=${actor}::uuid FOR UPDATE`;
      const profile=rows[0];if(!profile)throw new AppError(404,'PROFILE_NOT_FOUND','Perfil no encontrado');
      const prior=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:'OPPORTUNITY_APPLICATION',idempotencyKey:key}}});
      const included={opportunity:{include:{organization:{select:{name:true}}}}} as const;
      if(prior) {
        if(prior.payloadHash!==hash)throw new AppError(409,'IDEMPOTENCY_CONFLICT','La clave corresponde a otro consentimiento');
        const current=await tx.candidateApplication.findUnique({where:{candidateProfileId_opportunityId:{candidateProfileId:profile.id,opportunityId}},include:included});
        if(!current)throw new AppError(409,'APPLICATION_STATE_UNAVAILABLE','No se pudo recuperar el estado actual');
        return this.asView(current); // An old retry must never restore withdrawn consent.
      }
      const revision=await tx.profileRevision.findFirst({where:{id:req.profile_revision_id,profileId:profile.id,status:'CONFIRMED'}});
      if(!revision||profile.currentVersionId!==revision.id)throw new AppError(400,'INVALID_PROFILE_REVISION','Selecciona la versión confirmada vigente');
      const opp=await tx.opportunity.findFirst({where:{id:opportunityId,active:true,organization:{active:true,type:'COMPANY'}}});
      if(!opp)throw new AppError(404,'OPPORTUNITY_NOT_FOUND','La vacante solicitada no está disponible');
      const existing=await tx.candidateApplication.findUnique({where:{candidateProfileId_opportunityId:{candidateProfileId:profile.id,opportunityId}},include:included});
      if(existing?.status==='WITHDRAWN'&&!req.idempotency_key)throw new AppError(409,'NEW_CONSENT_REQUIRED','Confirma de nuevo con una nueva clave de consentimiento para reactivar');
      if(existing?.status==='ACTIVE'&&existing.profileRevisionId!==revision.id)throw new AppError(409,'APPLICATION_VERSION_CONFLICT','Retira la autorización anterior antes de compartir otra versión');
      const application=existing?.status==='ACTIVE'?existing:existing?await tx.candidateApplication.update({where:{id:existing.id},data:{status:'ACTIVE',profileRevisionId:revision.id,consentGivenAt:new Date(),withdrawnAt:null,withdrawalReason:null,receiptNumber:`REC-APP-${randomUUID()}`},include:included}):await tx.candidateApplication.create({data:{id:randomUUID(),opportunityId,candidateProfileId:profile.id,profileRevisionId:revision.id,status:'ACTIVE',receiptNumber:`REC-APP-${randomUUID()}`},include:included});
      const result=this.asView(application);
      await this.record(tx,actor,profile.id,'OPPORTUNITY_APPLICATION',key,hash,result,existing?.status==='WITHDRAWN'?'NEW_EXPLICIT_CONSENT':existing?'ALREADY_ACTIVE':'EXPLICIT_CONSENT');
      return result;
    });
  }

  async listMyApplications(identity: VerifiedIdentity): Promise<CandidateApplicationView[]> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { ownerUserId: actorUserId },
      });
      if (!profile) return [];

      const applications = await tx.candidateApplication.findMany({
        where: { candidateProfileId: profile.id },
        include: {
          opportunity: {
            include: { organization: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return applications.map((app) => ({
        id: app.id,
        opportunity_id: app.opportunityId,
        opportunity_title: app.opportunity.title,
        company_name: app.opportunity.organization.name,
        profile_revision_id: app.profileRevisionId,
        status: app.status,
        receipt_number: app.receiptNumber,
        consent_given_at: app.consentGivenAt.toISOString(),
        withdrawn_at: app.withdrawnAt ? app.withdrawnAt.toISOString() : null,
        withdrawal_reason: app.withdrawalReason,
        created_at: app.createdAt.toISOString(),
      }));
    });
  }

  async withdrawApplication(identity:VerifiedIdentity,applicationId:string,req:WithdrawApplicationRequest):Promise<CandidateApplicationView> {
    const actor=await this.resolveActor(identity),key=this.key(req.idempotency_key,`withdrawal:${applicationId}`),reason=req.reason??'Retirada voluntaria del candidato';
    const hash=createHash('sha256').update(JSON.stringify({applicationId,reason})).digest('hex');
    return this.db.withActor(actor,async tx=>{
      const profiles=await tx.$queryRaw<{id:string}[]>`SELECT id FROM app."CandidateProfile" WHERE "ownerUserId"=${actor}::uuid FOR UPDATE`;
      const profile=profiles[0];if(!profile)throw new AppError(404,'PROFILE_NOT_FOUND','Perfil no encontrado');
      const included={opportunity:{include:{organization:{select:{name:true}}}}} as const;
      const existing=await tx.candidateApplication.findFirst({where:{id:applicationId,candidateProfileId:profile.id},include:included});
      if(!existing)throw new AppError(404,'APPLICATION_NOT_FOUND','Postulación no encontrada');
      const prior=await tx.operationReceipt.findUnique({where:{actorUserId_operation_idempotencyKey:{actorUserId:actor,operation:'OPPORTUNITY_APPLICATION_WITHDRAWAL',idempotencyKey:key}}});
      if(prior) {if(prior.payloadHash!==hash)throw new AppError(409,'IDEMPOTENCY_CONFLICT','La clave corresponde a otra retirada');return this.asView(existing);}
      const updated=existing.status==='WITHDRAWN'?existing:await tx.candidateApplication.update({where:{id:applicationId},data:{status:'WITHDRAWN',withdrawnAt:new Date(),withdrawalReason:reason},include:included});
      const result=this.asView(updated);await this.record(tx,actor,profile.id,'OPPORTUNITY_APPLICATION_WITHDRAWAL',key,hash,result,'CANDIDATE_WITHDREW_CONSENT');return result;
    });
  }
}
