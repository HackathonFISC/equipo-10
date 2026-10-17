import type { TrainingCourseSummary, TrainingCourseDraft, TrainingCoursePublication, SyllabusInterpretation, SyllabusInterpretRequest, TrainingParticipantView, TrainingCompletionRequest, TrainingCompletionView, TrainingCourseWorkspace } from '@equipo10/contracts';
import { fetchWithHeaders } from '../../lib/api';
import type { AssessmentBank, AssessmentBankProposal, AssessmentBankConfirmation, AssessmentAttemptPublic, AssessmentSubmission } from '@equipo10/contracts';

export interface TrainingCourseDetail extends TrainingCourseSummary {
  workspace?: Omit<TrainingCourseWorkspace, 'expected_updated_at'> | null;
  versions: { id: string; catalog_version_id: string; version_number: number; syllabus_text: string;
    outcomes: { competency_id: string; description: string }[];
    prerequisites: { competency_id: string; description: string }[];
    editions: { id: string; modality: string; location: string; start_date: string; end_date: string; total_slots: number; available_slots: number }[];
  }[];
}
export async function saveTrainingWorkspace(org: string, id: string, token: string, body: TrainingCourseWorkspace, key: string) {
  return (await fetchWithHeaders<{ workspace: Omit<TrainingCourseWorkspace, 'expected_updated_at'>; updated_at: string }>(`${path(org)}/${encodeURIComponent(id)}/workspace`, token, { method: 'PATCH', body, headers: { 'Idempotency-Key': key } })).data;
}
export interface PublicationReceipt { course_id: string; version_id: string; edition_id: string; receipt_id: string }
const path = (org: string) => `/organizations/${encodeURIComponent(org)}/training-courses`;
export async function listTrainingCourses(org: string, token: string, signal?: AbortSignal) {
  return (await fetchWithHeaders<{ items: TrainingCourseSummary[]; total: number }>(path(org), token, { signal })).data;
}
export async function getTrainingCourse(org: string, id: string, token: string) {
  return (await fetchWithHeaders<TrainingCourseDetail>(`${path(org)}/${encodeURIComponent(id)}`, token)).data;
}
export async function createTrainingCourse(org: string, token: string, body: TrainingCourseDraft, key: string) {
  return (await fetchWithHeaders<TrainingCourseSummary>(path(org), token, { method: 'POST', body, headers: { 'Idempotency-Key': key } })).data;
}
export async function interpretTrainingCourse(org: string, id: string, token: string, body: SyllabusInterpretRequest) {
  return (await fetchWithHeaders<SyllabusInterpretation>(`${path(org)}/${encodeURIComponent(id)}/interpret`, token, { method: 'POST', body })).data;
}
export async function publishTrainingCourse(org: string, id: string, token: string, body: TrainingCoursePublication, key: string) {
  return (await fetchWithHeaders<PublicationReceipt>(`${path(org)}/${encodeURIComponent(id)}/publications`, token, { method: 'POST', body, headers: { 'Idempotency-Key': key } })).data;
}
export async function listTrainingParticipants(org: string, token: string, signal?: AbortSignal) {
  return (await fetchWithHeaders<{ items: TrainingParticipantView[] }>(`/organizations/${encodeURIComponent(org)}/training-participants`, token, { signal })).data;
}
export async function recordTrainingCompletion(org: string, reservation: string, token: string, body: TrainingCompletionRequest, key: string) {
  return (await fetchWithHeaders<{ completion: TrainingCompletionView; isReplay: boolean }>(`/organizations/${encodeURIComponent(org)}/training-participants/${encodeURIComponent(reservation)}/completions`, token, { method: 'POST', body, headers: { 'Idempotency-Key': key } })).data;
}
export async function listAssessmentBanks(org: string, course: string, token: string, signal?: AbortSignal) {
  return (await fetchWithHeaders<{ items: AssessmentBank[] }>(`${path(org)}/${encodeURIComponent(course)}/banks`, token, { signal })).data;
}
export async function proposeAssessmentBank(org: string, course: string, token: string) {
  return (await fetchWithHeaders<AssessmentBankProposal>(`${path(org)}/${encodeURIComponent(course)}/banks/proposals`, token, { method: 'POST', body: { consent: true } })).data;
}
export async function confirmAssessmentBank(org: string, course: string, token: string, body: AssessmentBankConfirmation, key: string) {
  return (await fetchWithHeaders<AssessmentBank>(`${path(org)}/${encodeURIComponent(course)}/banks`, token, { method: 'POST', body, headers: { 'Idempotency-Key': key } })).data;
}
export async function getAvailableAssessment(course: string, token: string, signal?: AbortSignal) {
  return (await fetchWithHeaders<{ id: string; course_version_id: string; question_count: number }>(`/courses/${encodeURIComponent(course)}/assessment-bank`, token, { signal })).data;
}
export async function startTrainingAssessment(course: string, token: string, bank: string, key: string) {
  return (await fetchWithHeaders<AssessmentAttemptPublic>(`/courses/${encodeURIComponent(course)}/assessment-attempts`, token, { method: 'POST', body: { bank_id: bank, consent: true }, headers: { 'Idempotency-Key': key } })).data;
}
export async function listTrainingAssessments(course: string, token: string, signal?: AbortSignal) {
  return (await fetchWithHeaders<{ items: AssessmentAttemptPublic[] }>(`/courses/${encodeURIComponent(course)}/assessment-attempts`, token, { signal })).data;
}
export async function getTrainingAssessment(id: string, token: string, signal?: AbortSignal) {
  return (await fetchWithHeaders<AssessmentAttemptPublic>(`/me/training-assessment-attempts/${encodeURIComponent(id)}`, token, { signal })).data;
}
export async function submitTrainingAssessment(id: string, token: string, body: AssessmentSubmission, key: string) {
  return (await fetchWithHeaders<AssessmentAttemptPublic>(`/me/training-assessment-attempts/${encodeURIComponent(id)}/submissions`, token, { method: 'POST', body, headers: { 'Idempotency-Key': key } })).data;
}
export async function associateTrainingAssessment(id: string, token: string, key: string) {
  return (await fetchWithHeaders<{ attempt_id: string; association_id: string; scope: 'EXERCISE_ONLY' }>(`/me/training-assessment-attempts/${encodeURIComponent(id)}/associations`, token, { method: 'POST', body: { confirm: true }, headers: { 'Idempotency-Key': key } })).data;
}
