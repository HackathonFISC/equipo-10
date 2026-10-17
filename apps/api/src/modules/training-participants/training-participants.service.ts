import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import type { ActorTransactionOptions } from '../../infrastructure/database';
import type { VerifiedIdentity } from '../../security/auth';
import { AppError } from '../../errors';
import {
  TrainingCompletionRequestSchema,
  type TrainingCompletionRequest,
  type TrainingCompletionView,
  type TrainingParticipantView,
  type TrainingCertificateView,
} from '@equipo10/contracts';

export interface TrainingParticipantsDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}
type CompletionRow = {
  id: string; reservationId: string; organizationId: string;
  decision: 'COMPLETED' | 'NOT_COMPLETED'; completedOn: Date; reason: string;
  revision: number; recordedAt: Date;
  course_title?: string; reservation_number?: string; edition_id?: string;
};
function view(row: CompletionRow): TrainingCompletionView {
  return { id: row.id, reservation_id: row.reservationId, organization_id: row.organizationId,
    decision: row.decision, completed_on: row.completedOn.toISOString().slice(0, 10),
    reason: row.reason, revision: row.revision, recorded_at: row.recordedAt.toISOString(),
    certificate_status: 'PENDING_PRIVATE_ATTACHMENT',
    ...(row.course_title ? { course_title: row.course_title } : {}),
    ...(row.reservation_number ? { reservation_number: row.reservation_number } : {}),
    ...(row.edition_id ? { edition_id: row.edition_id } : {}) };
}

export class TrainingParticipantsService {
  constructor(private readonly db: TrainingParticipantsDatabase) {}

  private async actor(identity: VerifiedIdentity) {
    const actor = await this.db.resolveAuthSubject(identity.id, false);
    if (!actor) throw new AppError(404, 'ACCOUNT_NOT_INITIALIZED', 'La cuenta no está inicializada');
    return actor;
  }
  private async assertManager(tx: Prisma.TransactionClient, organizationId: string) {
    const [access] = await tx.$queryRaw<{ allowed: boolean }[]>`
      SELECT app.can_manage_training_center(${organizationId}::uuid) AS allowed`;
    if (!access?.allowed) throw new AppError(404, 'TRAINING_CENTER_NOT_FOUND', 'Centro no disponible');
  }
  private async certificates(tx: Prisma.TransactionClient) {
    const rows=await tx.$queryRaw<{id:string;completionId:string;originalFilename:string;contentType:'application/pdf';sizeBytes:number;sha256:string;recordedAt:Date}[]>`SELECT * FROM app."TrainingCertificate"`;
    return new Map(rows.map(r=>[r.completionId,{id:r.id,completion_id:r.completionId,original_filename:r.originalFilename,content_type:r.contentType,size_bytes:r.sizeBytes,sha256:r.sha256,recorded_at:r.recordedAt.toISOString()} satisfies TrainingCertificateView]));
  }

  async listParticipants(identity: VerifiedIdentity, organizationId: string, courseId?: string): Promise<{ items: TrainingParticipantView[] }> {
    const actor = await this.actor(identity);
    return this.db.withActor(actor, async (tx) => {
      await this.assertManager(tx, organizationId);
      const participants = await tx.$queryRaw<Omit<TrainingParticipantView, 'completion'>[]>`
        SELECT * FROM app.training_participants(${organizationId}::uuid,${courseId ?? null}::uuid)`;
      const completions = await tx.$queryRaw<CompletionRow[]>`
        SELECT * FROM app."TrainingCompletion" WHERE "organizationId"=${organizationId}::uuid`;
      const certificates=await this.certificates(tx);
      const byReservation = new Map(completions.map((row) => {const completion=view(row),certificate=certificates.get(row.id);return [row.reservationId,certificate?{...completion,certificate,certificate_status:'AVAILABLE' as const}:completion];}));
      return { items: participants.map((row) => ({ ...row, completion: byReservation.get(row.reservation_id) ?? null })) };
    });
  }

  async listOwnCompletions(identity: VerifiedIdentity): Promise<{ items: TrainingCompletionView[] }> {
    const actor = await this.actor(identity);
    return this.db.withActor(actor, async (tx) => {
      const rows = await tx.$queryRaw<CompletionRow[]>`SELECT * FROM app.own_training_completions()`;
      const certificates=await this.certificates(tx);
      return { items: rows.map(row=>{const completion=view(row),certificate=certificates.get(row.id);return certificate?{...completion,certificate,certificate_status:'AVAILABLE' as const}:completion;}) };
    });
  }

  async recordCompletion(identity: VerifiedIdentity, organizationId: string, reservationId: string,
    input: TrainingCompletionRequest, idempotencyKey?: string): Promise<{ completion: TrainingCompletionView; isReplay: boolean }> {
    const parsed = TrainingCompletionRequestSchema.safeParse(input);
    if (!parsed.success) throw new AppError(400, 'INVALID_REQUEST', 'Revisa el resultado, motivo y fecha de finalización');
    if (!idempotencyKey || !/^[\x21-\x7E]{16,128}$/.test(idempotencyKey)) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Envía una clave de operación de 16 a 128 caracteres');
    }
    const body = parsed.data;
    const actor = await this.actor(identity);
    const hash = createHash('sha256').update(JSON.stringify({ organizationId, reservationId, ...body })).digest('hex');
    return this.db.withActor(actor, async (tx) => {
      await this.assertManager(tx, organizationId);
      // Serialize the operation key before checking its receipt; protects concurrent replays.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${actor}:TRAINING_COMPLETION:${idempotencyKey}`},0))`;
      const receipt = await tx.operationReceipt.findUnique({ where: { actorUserId_operation_idempotencyKey: {
        actorUserId: actor, operation: 'TRAINING_COMPLETION', idempotencyKey,
      } } });
      if (receipt) {
        if (receipt.payloadHash !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya corresponde a otra operación');
        return { completion: receipt.receiptPayload as unknown as TrainingCompletionView, isReplay: true };
      }
      const [reservation] = await tx.$queryRaw<{ status: string | null }[]>`
        SELECT app.lock_training_reservation(${organizationId}::uuid,${reservationId}::uuid) AS status`;
      if (!reservation?.status) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reserva no disponible en este centro');
      if (reservation.status !== body.expected_status) {
        throw new AppError(409, 'RESERVATION_STATUS_CONFLICT', 'La reserva cambió o fue cancelada. Actualiza la lista');
      }
      const existing = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM app."TrainingCompletion" WHERE "reservationId"=${reservationId}::uuid`;
      if (existing.length) throw new AppError(409, 'COMPLETION_ALREADY_RECORDED', 'Ya existe un resultado; su corrección requiere un proceso separado');
      const [dateCheck] = await tx.$queryRaw<{ allowed: boolean }[]>`
        SELECT app.can_record_training_completion(${reservationId}::uuid,${organizationId}::uuid,${body.completed_on}::date) AS allowed`;
      if (!dateCheck?.allowed) throw new AppError(422, 'INVALID_COMPLETION_DATE', 'La fecha debe corresponder al período del curso y no ser futura');
      const [row] = await tx.$queryRaw<CompletionRow[]>`
        INSERT INTO app."TrainingCompletion" (id,"reservationId","organizationId","actorUserId",decision,"completedOn",reason)
        VALUES (${randomUUID()}::uuid,${reservationId}::uuid,${organizationId}::uuid,${actor}::uuid,${body.decision},${body.completed_on}::date,${body.reason})
        RETURNING *`;
      const completion = view(row!);
      const operation = await tx.operationReceipt.create({ data: { id: randomUUID(), actorUserId: actor,
        operation: 'TRAINING_COMPLETION', idempotencyKey, payloadHash: hash,
        receiptPayload: completion as unknown as Prisma.InputJsonValue } });
      await tx.auditEvent.create({ data: { id: randomUUID(), actorUserId: actor, operationId: operation.id,
        caseId: 'D7_TRAINING_COMPLETION', event: 'TRAINING_COMPLETION_RECORDED', reasonCode: body.decision } });
      // Deliberately retain reservation/capacity and skills. Completion is not accreditation.
      return { completion, isReplay: false };
    }, { timeout: 15_000 });
  }
}
