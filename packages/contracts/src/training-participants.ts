import { z } from 'zod';
import type { TrainingCertificateView } from './training-certificates';

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Fecha no válida');

export const TrainingCompletionRequestSchema = z.object({
  decision: z.enum(['COMPLETED', 'NOT_COMPLETED']),
  reason: z.string().trim().min(3).max(1000),
  completed_on: DateOnlySchema.refine((value) => value <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura'),
  expected_status: z.literal('CONFIRMED'),
}).strict();
export type TrainingCompletionRequest = z.infer<typeof TrainingCompletionRequestSchema>;
export interface TrainingCompletionView {
  id: string;
  reservation_id: string;
  organization_id: string;
  decision: 'COMPLETED' | 'NOT_COMPLETED';
  completed_on: string;
  reason: string;
  revision: number;
  certificate_status: 'PENDING_PRIVATE_ATTACHMENT' | 'AVAILABLE';
  certificate?: TrainingCertificateView;
  recorded_at: string;
  course_title?: string;
  reservation_number?: string;
  edition_id?: string;
}
export interface TrainingParticipantView {
  reservation_id: string;
  reservation_number: string;
  status: string;
  course_id: string;
  course_title: string;
  edition_id: string;
  participant_name: string | null;
  completion: TrainingCompletionView | null;
}
