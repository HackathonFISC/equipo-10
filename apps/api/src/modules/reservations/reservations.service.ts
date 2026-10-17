import { createHash, randomUUID } from "node:crypto";
import { AppError } from "../../errors";
import type { VerifiedIdentity } from "../../security/auth";
import type {
  CourseReservationRequest,
  CourseReservationView,
  CourseReservationCancellationRequest,
  AgendaView,
  AgendaEventView,
} from "@equipo10/contracts";
import type { Prisma } from "../../../../../generated/prisma/client.js";
import type { ActorTransactionOptions } from "../../infrastructure/database";

export interface ReservationsDatabase {
  resolveAuthSubject(subject: string, bootstrap: boolean): Promise<string | null>;
  withActor<T>(id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: ActorTransactionOptions): Promise<T>;
}

function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export class ReservationsService {
  constructor(private readonly db: ReservationsDatabase) {}

  async resolveActor(identity: VerifiedIdentity): Promise<string> {
    const actorUserId = await this.db.resolveAuthSubject(identity.id, false);
    if (!actorUserId) {
      throw new AppError(404, "ACCOUNT_NOT_INITIALIZED", "La cuenta no está inicializada");
    }
    return actorUserId;
  }

  async createReservation(
    identity: VerifiedIdentity,
    body: CourseReservationRequest,
    idempotencyKey?: string
  ): Promise<{ reservation: CourseReservationView; isReplay: boolean }> {
    const actorUserId = await this.resolveActor(identity);
    const normalizedKey = idempotencyKey?.trim() || undefined;

    const payloadHash = normalizedKey
      ? createHash("sha256")
          .update(JSON.stringify({ edition_id: body.edition_id, plan_id: body.plan_id ?? null }))
          .digest("hex")
      : undefined;

    // Si hay clave idempotente, verificar primero si ya se registró
    if (normalizedKey && payloadHash) {
      const existingReceipt = await this.db.withActor(actorUserId, async (tx) => {
        return tx.operationReceipt.findFirst({
          where: {
            actorUserId,
            operation: "COURSE_RESERVATION",
            idempotencyKey: normalizedKey,
          },
        });
      });

      if (existingReceipt) {
        if (existingReceipt.payloadHash === payloadHash) {
          return {
            reservation: existingReceipt.receiptPayload as unknown as CourseReservationView,
            isReplay: true,
          };
        } else {
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "La clave de idempotencia ya fue utilizada con un cuerpo de solicitud diferente"
          );
        }
      }
    }

    // Transacción corta y atómica bajo orden consistente de bloqueos
    return this.db.withActor(actorUserId, async (tx) => {
      // 1. Bloqueo de agenda del candidato (serializa operaciones concurrentes del mismo candidato)
      const profileRows = await tx.$queryRaw<Array<{ id: string; currentVersionId: string | null }>>`
        SELECT id, "currentVersionId"
        FROM app."CandidateProfile"
        WHERE "ownerUserId" = ${actorUserId}::uuid
        FOR UPDATE
      `;

      if (!profileRows || profileRows.length === 0) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Perfil de candidato no encontrado");
      }
      const profile = profileRows[0];
      if (!profile.currentVersionId) {
        throw new AppError(412, "PROFILE_NOT_CONFIRMED", "Debes tener un perfil confirmado para realizar reservas");
      }

      // 2. Bloqueo de la fila de CourseEdition (serializa cupos y evita sobreventa)
      const editionRows = await tx.$queryRaw<Array<{
        id: string;
        courseVersionId: string;
        totalSlots: number;
        active: boolean;
        startDate: Date;
        endDate: Date;
        title: string;
        scheduleSummary: string;
      }>>`
        SELECT e.id, e."courseVersionId", e."totalSlots", e.active, e."startDate", e."endDate", c.title, e."scheduleSummary"
        FROM app."CourseEdition" e
        JOIN app."CourseVersion" cv ON cv.id = e."courseVersionId"
        JOIN app."Course" c ON c.id = cv."courseId"
        WHERE e.id = ${body.edition_id}::uuid
        FOR UPDATE OF e
      `;

      if (!editionRows || editionRows.length === 0) {
        throw new AppError(404, "EDITION_NOT_FOUND", "Edición formativa no encontrada");
      }
      const edition = editionRows[0];

      if (!edition.active) {
        throw new AppError(409, "EDITION_NOT_AVAILABLE", "La edición no se encuentra disponible para reservas");
      }

      if (new Date(edition.startDate).getTime() < Date.now()) {
        throw new AppError(409, "EDITION_EXPIRED", "La edición ya ha comenzado o ha expirado");
      }

      // 3. Verificación de capacidad: cupo total menos reservas confirmadas activas (función segura con bypass de RLS)
      const countRows = await tx.$queryRaw<Array<{ count: number }>>`
        SELECT app.count_active_reservations(${body.edition_id}::uuid) AS count
      `;
      const activeCount = Number(countRows[0]?.count ?? 0);

      if (activeCount >= edition.totalSlots) {
        throw new AppError(409, "NO_AVAILABLE_SLOTS", "La edición solicitada no dispone de plazas disponibles");
      }

      // 4. Verificación de reserva duplicada para el mismo candidato en esta edición
      const existingCandidateRes = await tx.courseReservation.findFirst({
        where: {
          profileId: profile.id,
          editionId: body.edition_id,
          status: "CONFIRMED",
        },
      });
      if (existingCandidateRes) {
        throw new AppError(409, "ALREADY_RESERVED", "Ya posees una reserva activa confirmada para esta edición");
      }

      // 5. Revalidación estricta de prerrequisitos del curso
      const prereqs = await tx.coursePrerequisite.findMany({
        where: { courseVersionId: edition.courseVersionId },
      });

      if (prereqs.length > 0) {
        const acceptedClaims = await tx.competencyClaim.findMany({
          where: {
            revisionId: profile.currentVersionId,
            decision: "ACCEPTED",
          },
          select: { competencyId: true },
        });

        const acceptedSet = new Set(acceptedClaims.map((c) => c.competencyId));
        for (const pr of prereqs) {
          if (!acceptedSet.has(pr.competencyId)) {
            throw new AppError(
              409,
              "PREREQUISITES_NOT_MET",
              `No cumples con los prerrequisitos acreditados para esta edición (competencia requerida: ${pr.competencyId})`
            );
          }
        }
      }

      // 5.1 D8: Verificación de acompañamiento de ruta si la reserva deriva de un plan bajo revisión
      let planIdToCheck = body.plan_id;
      if (!planIdToCheck) {
        // Si no se suministra plan_id, comprobar si la edición forma parte de una ruta con acompañamiento
        // ACTIVO NO APROBADO (REQUESTED, IN_REVIEW, CLARIFICATION_REQUESTED, REJECTED).
        // Si está en acompañamiento activo pendiente, no se puede eludir la revisión omitiendo plan_id.
        // Si el acompañamiento fue REVOCADO o no existe acompañamiento activo, se permite la reserva independiente.
        const activeAccompaniedStep = await tx.learningPlanStep.findFirst({
          where: {
            editionId: body.edition_id,
            plan: {
              profileId: profile.id,
              orientationEngagements: {
                some: {
                  candidateProfileId: profile.id,
                  status: {
                    in: ["REQUESTED", "IN_REVIEW", "CLARIFICATION_REQUESTED", "REJECTED"],
                  },
                },
              },
            },
          },
          orderBy: {
            plan: {
              updatedAt: "desc",
            },
          },
          select: { planId: true },
        });

        if (activeAccompaniedStep) {
          throw new AppError(
            409,
            "PLAN_REVIEW_NOT_APPROVED",
            "Esta edición forma parte de una ruta formativa actualmente en proceso de acompañamiento no aprobado. Debes esperar el dictamen del orientador o revocar el acompañamiento para inscribirte de forma independiente."
          );
        }
      }

      if (planIdToCheck) {
        const plan = await tx.learningPlan.findFirst({
          where: { id: planIdToCheck, profileId: profile.id },
          include: {
            orientationEngagements: {
              where: { candidateProfileId: profile.id },
              orderBy: { requestedAt: "desc" },
              take: 1,
            },
          },
        });

        if (plan && plan.orientationEngagements.length > 0) {
          const engagement = plan.orientationEngagements[0];
          if (engagement.status === "REVOKED") {
            throw new AppError(
              409,
              "ORIENTATION_REVOKED",
              "El acompañamiento para este plan formativo fue revocado. Debes solicitar una nueva revisión o confirmar la ruta de forma independiente."
            );
          }
          if (engagement.status !== "APPROVED") {
            throw new AppError(
              409,
              "PLAN_REVIEW_NOT_APPROVED",
              "La ruta formativa enviada a acompañamiento requiere una revisión aprobada y vigente antes de confirmar reservas."
            );
          }
          if (engagement.planVersion !== plan.version || engagement.revisionId !== profile.currentVersionId) {
            throw new AppError(
              409,
              "OUTDATED_PLAN_REVIEW",
              "La revisión aprobada del orientador corresponde a una versión desactualizada de la ruta o de tu perfil."
            );
          }
        }
      }

      // 6. Verificación de colisión horaria con otras reservas activas del candidato
      const targetSessions = await tx.courseSession.findMany({
        where: { editionId: body.edition_id },
      });

      const otherReservations = await tx.courseReservation.findMany({
        where: {
          profileId: profile.id,
          status: "CONFIRMED",
          editionId: { not: body.edition_id },
        },
        include: {
          edition: {
            include: {
              sessions: true,
            },
          },
        },
      });

      for (const otherRes of otherReservations) {
        const otherEdition = otherRes.edition;
        // Comprobar si las fechas globales de las ediciones se solapan
        const datesOverlap =
          new Date(edition.startDate) <= new Date(otherEdition.endDate) &&
          new Date(otherEdition.startDate) <= new Date(edition.endDate);

        if (datesOverlap) {
          for (const ts of targetSessions) {
            for (const os of otherEdition.sessions) {
              if (ts.weekday === os.weekday) {
                const timeOverlap = ts.startMinute < os.endMinute && os.startMinute < ts.endMinute;
                if (timeOverlap) {
                  throw new AppError(
                    409,
                    "SCHEDULE_COLLISION",
                    "El horario de esta edición colisiona con otra reserva activa confirmada en tu agenda"
                  );
                }
              }
            }
          }
        }
      }

      // 7. Inserción atómica de CourseReservation
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randStr = randomUUID().replace(/-/g, "").substring(0, 6).toUpperCase();
      const reservationNumber = `RES-${dateStr}-${randStr}`;

      const reservation = await tx.courseReservation.create({
        data: {
          id: randomUUID(),
          profileId: profile.id,
          editionId: body.edition_id,
          planId: body.plan_id ?? null,
          status: "CONFIRMED",
          reservationNumber,
        },
      });

      const remainingSlots = edition.totalSlots - (activeCount + 1);
      const receiptId = normalizedKey ? randomUUID() : undefined;

      const reservationView: CourseReservationView = {
        id: reservation.id,
        reservation_number: reservation.reservationNumber,
        edition_id: edition.id,
        course_title: edition.title,
        status: "CONFIRMED",
        schedule_summary: edition.scheduleSummary || "Horario programado",
        remaining_slots: remainingSlots,
        receipt_id: receiptId,
        created_at: reservation.createdAt.toISOString(),
        cancelled_at: null,
        cancellation_reason: null,
      };

      // 8. Registro de OperationReceipt si se suministró clave idempotente
      if (normalizedKey && payloadHash && receiptId) {
        await tx.operationReceipt.create({
          data: {
            id: receiptId,
            actorUserId,
            profileId: profile.id,
            operation: "COURSE_RESERVATION",
            idempotencyKey: normalizedKey,
            payloadHash,
            receiptPayload: reservationView as any,
          },
        });
      }

      // 9. Auditoría formal
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile.id,
          revisionId: profile.currentVersionId,
          operationId: receiptId ?? null,
          caseId: "CASE-D4-RESERVATION",
          event: "COURSE_RESERVATION_CONFIRMED",
          reasonCode: "CONFIRMED_BY_CANDIDATE",
        },
      });

      return { reservation: reservationView, isReplay: false };
    });
  }

  async cancelReservation(
    identity: VerifiedIdentity,
    reservationId: string,
    body: CourseReservationCancellationRequest,
    idempotencyKey?: string
  ): Promise<CourseReservationView> {
    const actorUserId = await this.resolveActor(identity);
    const normalizedKey = idempotencyKey?.trim() || undefined;

    return this.db.withActor(actorUserId, async (tx) => {
      // Bloqueo de agenda del candidato
      const profileRows = await tx.$queryRaw<Array<{ id: string; currentVersionId: string | null }>>`
        SELECT id, "currentVersionId"
        FROM app."CandidateProfile"
        WHERE "ownerUserId" = ${actorUserId}::uuid
        FOR UPDATE
      `;
      if (!profileRows || profileRows.length === 0) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Perfil de candidato no encontrado");
      }
      const profile = profileRows[0];

      const res = await tx.courseReservation.findUnique({
        where: { id: reservationId },
        include: {
          edition: {
            include: {
              courseVersion: {
                include: {
                  course: { select: { title: true } },
                },
              },
            },
          },
        },
      });

      if (!res || res.profileId !== profile.id) {
        throw new AppError(404, "RESERVATION_NOT_FOUND", "Reserva no encontrada");
      }

      // Si ya estaba cancelada: idempotencia exacta sin volver a liberar cupo
      if (res.status === "CANCELLED") {
        const countRows = await tx.$queryRaw<Array<{ count: number }>>`
          SELECT app.count_active_reservations(${res.editionId}::uuid) AS count
        `;
        const activeCount = Number(countRows[0]?.count ?? 0);
        return {
          id: res.id,
          reservation_number: res.reservationNumber,
          edition_id: res.editionId,
          course_title: res.edition.courseVersion.course.title,
          status: "CANCELLED",
          schedule_summary: res.edition.scheduleSummary || "Horario programado",
          remaining_slots: res.edition.totalSlots - activeCount,
          created_at: res.createdAt.toISOString(),
          cancelled_at: res.cancelledAt?.toISOString() || null,
          cancellation_reason: res.cancellationReason || null,
        };
      }

      // Bloquear edición para recontar
      await tx.$queryRaw`
        SELECT id FROM app."CourseEdition" WHERE id = ${res.editionId}::uuid FOR UPDATE
      `;

      const updated = await tx.courseReservation.update({
        where: { id: reservationId },
        data: {
          status: "CANCELLED",
          cancellationReason: body.reason,
          cancelledAt: new Date(),
        },
      });

      const countRows = await tx.$queryRaw<Array<{ count: number }>>`
        SELECT app.count_active_reservations(${res.editionId}::uuid) AS count
      `;
      const activeCount = Number(countRows[0]?.count ?? 0);
      const remainingSlots = res.edition.totalSlots - activeCount;

      const receiptId = normalizedKey ? randomUUID() : undefined;
      const resultView: CourseReservationView = {
        id: updated.id,
        reservation_number: updated.reservationNumber,
        edition_id: res.editionId,
        course_title: res.edition.courseVersion.course.title,
        status: "CANCELLED",
        schedule_summary: res.edition.scheduleSummary || "Horario programado",
        remaining_slots: remainingSlots,
        receipt_id: receiptId,
        created_at: updated.createdAt.toISOString(),
        cancelled_at: updated.cancelledAt?.toISOString() || null,
        cancellation_reason: updated.cancellationReason || null,
      };

      if (normalizedKey && receiptId) {
        const payloadHash = createHash("sha256")
          .update(JSON.stringify({ reservation_id: reservationId, reason: body.reason }))
          .digest("hex");

        await tx.operationReceipt.create({
          data: {
            id: receiptId,
            actorUserId,
            profileId: profile.id,
            operation: "COURSE_RESERVATION_CANCELLATION",
            idempotencyKey: normalizedKey,
            payloadHash,
            receiptPayload: resultView as any,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorUserId,
          profileId: profile.id,
          revisionId: profile.currentVersionId,
          operationId: receiptId ?? null,
          caseId: "CASE-D4-CANCELLATION",
          event: "COURSE_RESERVATION_CANCELLED",
          reasonCode: body.reason.substring(0, 80),
        },
      });

      return resultView;
    });
  }

  async listReservations(identity: VerifiedIdentity): Promise<CourseReservationView[]> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findFirst({
        where: { ownerUserId: actorUserId },
        select: { id: true },
      });
      if (!profile) return [];

      const rows = await tx.courseReservation.findMany({
        where: { profileId: profile.id },
        orderBy: { createdAt: "desc" },
        include: {
          edition: {
            include: {
              courseVersion: {
                include: {
                  course: { select: { title: true } },
                },
              },
            },
          },
        },
      });

      return Promise.all(
        rows.map(async (r) => {
          const countRows = await tx.$queryRaw<Array<{ count: number }>>`
            SELECT app.count_active_reservations(${r.editionId}::uuid) AS count
          `;
          const activeCount = Number(countRows[0]?.count ?? 0);
          return {
            id: r.id,
            reservation_number: r.reservationNumber,
            edition_id: r.editionId,
            course_title: r.edition.courseVersion.course.title,
            status: r.status,
            schedule_summary: r.edition.scheduleSummary || "Horario programado",
            remaining_slots: Math.max(0, r.edition.totalSlots - activeCount),
            created_at: r.createdAt.toISOString(),
            cancelled_at: r.cancelledAt?.toISOString() || null,
            cancellation_reason: r.cancellationReason || null,
          };
        })
      );
    });
  }

  async getReservationById(identity: VerifiedIdentity, reservationId: string): Promise<CourseReservationView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findFirst({
        where: { ownerUserId: actorUserId },
        select: { id: true },
      });
      if (!profile) {
        throw new AppError(404, "RESERVATION_NOT_FOUND", "Reserva no encontrada");
      }

      const r = await tx.courseReservation.findUnique({
        where: { id: reservationId },
        include: {
          edition: {
            include: {
              courseVersion: {
                include: {
                  course: { select: { title: true } },
                },
              },
            },
          },
        },
      });

      if (!r || r.profileId !== profile.id) {
        throw new AppError(404, "RESERVATION_NOT_FOUND", "Reserva no encontrada");
      }

      const countRows = await tx.$queryRaw<Array<{ count: number }>>`
        SELECT app.count_active_reservations(${r.editionId}::uuid) AS count
      `;
      const activeCount = Number(countRows[0]?.count ?? 0);

      return {
        id: r.id,
        reservation_number: r.reservationNumber,
        edition_id: r.editionId,
        course_title: r.edition.courseVersion.course.title,
        status: r.status,
        schedule_summary: r.edition.scheduleSummary || "Horario programado",
        remaining_slots: Math.max(0, r.edition.totalSlots - activeCount),
        created_at: r.createdAt.toISOString(),
        cancelled_at: r.cancelledAt?.toISOString() || null,
        cancellation_reason: r.cancellationReason || null,
      };
    });
  }

  async getOperationReceipt(identity: VerifiedIdentity, key: string): Promise<any> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const receipt = await tx.operationReceipt.findFirst({
        where: {
          actorUserId,
          idempotencyKey: key,
        },
      });

      if (!receipt) {
        throw new AppError(404, "RECEIPT_NOT_FOUND", "Recibo de operación no encontrado");
      }

      return {
        id: receipt.id,
        operation: receipt.operation,
        idempotency_key: receipt.idempotencyKey,
        payload_hash: receipt.payloadHash,
        recorded_at: receipt.recordedAt.toISOString(),
        payload: receipt.receiptPayload,
      };
    });
  }

  async getAgenda(identity: VerifiedIdentity): Promise<AgendaView> {
    const actorUserId = await this.resolveActor(identity);

    return this.db.withActor(actorUserId, async (tx) => {
      const profile = await tx.candidateProfile.findFirst({
        where: { ownerUserId: actorUserId },
        select: { id: true },
      });
      if (!profile) {
        return { events: [] };
      }

      // Derivar sesiones exclusivamente de reservas confirmadas activas
      const activeReservations = await tx.courseReservation.findMany({
        where: {
          profileId: profile.id,
          status: "CONFIRMED",
        },
        include: {
          edition: {
            include: {
              courseVersion: {
                include: {
                  course: { select: { title: true } },
                },
              },
              sessions: true,
            },
          },
        },
      });

      const events: AgendaEventView[] = [];

      for (const res of activeReservations) {
        for (const s of res.edition.sessions) {
          events.push({
            id: s.id,
            reservation_id: res.id,
            course_title: res.edition.courseVersion.course.title,
            weekday: s.weekday,
            start_minute: s.startMinute,
            end_minute: s.endMinute,
            start_time: formatMinute(s.startMinute),
            end_time: formatMinute(s.endMinute),
            location: s.location || null,
            timezone: s.timezone,
            status: res.status,
          });
        }
      }

      // Ordenar cronológicamente por día de la semana y minuto de inicio
      events.sort((a, b) => {
        if (a.weekday !== b.weekday) return a.weekday - b.weekday;
        return a.start_minute - b.start_minute;
      });

      return { events };
    });
  }
}
