import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../app';
import { AppError } from '../../errors';
import { TrainingCompletionRequestSchema } from '@equipo10/contracts';
import type { TrainingParticipantsService } from './training-participants.service';

function id(value: string) {
  if (!z.string().uuid().safeParse(value).success) throw new AppError(400, 'INVALID_ID', 'Identificador no válido');
  return value;
}
export function createTrainingParticipantsController(service: TrainingParticipantsService): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  router.get('/organizations/:organizationId/training-participants', async (c) => {
    const course = c.req.query('course_id');
    const result = await service.listParticipants(c.get('identity'), id(c.req.param('organizationId')), course ? id(course) : undefined);
    return c.json({ data: result, request_id: c.get('requestId') });
  });
  router.post('/organizations/:organizationId/training-participants/:reservationId/completions', async (c) => {
    const raw = await c.req.json().catch(() => { throw new AppError(400, 'INVALID_REQUEST', 'JSON no válido'); });
    const parsed = TrainingCompletionRequestSchema.safeParse(raw);
    if (!parsed.success) throw new AppError(400, 'INVALID_REQUEST', 'Revisa el resultado, motivo y fecha de finalización');
    const result = await service.recordCompletion(c.get('identity'), id(c.req.param('organizationId')),
      id(c.req.param('reservationId')), parsed.data, c.req.header('Idempotency-Key'));
    return c.json({ data: result, request_id: c.get('requestId') }, result.isReplay ? 200 : 201);
  });
  router.get('/me/training-completions', async (c) => {
    return c.json({ data: await service.listOwnCompletions(c.get('identity')), request_id: c.get('requestId') });
  });
  return router;
}
