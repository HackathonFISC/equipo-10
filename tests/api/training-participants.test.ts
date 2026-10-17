import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { setupTestDatabase } from '../support/training-center-database-fixture';
import { TrainingParticipantsService } from '../../apps/api/src/modules/training-participants/training-participants.service';
import { TrainingCompletionRequestSchema } from '../../packages/contracts/src/training-participants';

describe('D7 centre participants and completion (isolated 55445)', () => {
  let fixture: Awaited<ReturnType<typeof setupTestDatabase>>;
  let service: TrainingParticipantsService;
  const manager = { id: randomUUID(), email: 'manager@example.test' };
  const otherManager = { id: randomUUID(), email: 'other@example.test' };
  const candidate = { id: randomUUID(), email: 'candidate@example.test' };
  const stranger = { id: randomUUID(), email: 'stranger@example.test' };
  const organization = randomUUID(), otherOrganization = randomUUID();
  const profile = randomUUID(), course = randomUUID(), version = randomUUID(), edition = randomUUID();
  const reservations = Array.from({ length: 5 }, () => randomUUID());
  const body = { decision: 'COMPLETED' as const, reason: 'Asistencia y evaluación final verificadas por el centro',
    completed_on: '2026-10-15', expected_status: 'CONFIRMED' as const };

  beforeAll(async () => {
    fixture = await setupTestDatabase();
    service = new TrainingParticipantsService(fixture.db);
    for (const actor of [manager, otherManager, candidate, stranger]) {
      await fixture.admin.query('INSERT INTO app."AppUser" (id,"authSubject","updatedAt") VALUES($1,$1,now())', [actor.id]);
    }
    for (const [org, actor] of [[organization, manager], [otherOrganization, otherManager]] as const) {
      await fixture.admin.query('INSERT INTO app."Organization" (id,name,type,"updatedAt") VALUES($1,\'Centro sintético\',\'TRAINING_CENTER\',now())', [org]);
      await fixture.admin.query('INSERT INTO app."OrganizationMembership" (id,"userId","organizationId",role,"updatedAt") VALUES($1,$2,$3,\'TRAINING_MANAGER\',now())', [randomUUID(), actor.id, org]);
    }
    const catalog = randomUUID();
    await fixture.admin.query('INSERT INTO app."CatalogVersion" (id,code,"sourceLabel") VALUES($1,\'D7-TEST\',\'Prueba sintética\')', [catalog]);
    await fixture.admin.query('INSERT INTO app."CandidateProfile" (id,"ownerUserId") VALUES($1,$2)', [profile, candidate.id]);
    await fixture.admin.query('INSERT INTO app."Course" (id,"organizationId",code,title,description,"updatedAt") VALUES($1,$2,\'D7-TEST\',\'Curso sintético\',\'Curso para prueba\',now())', [course, organization]);
    await fixture.admin.query('INSERT INTO app."CourseVersion" (id,"courseId","catalogVersionId","syllabusText") VALUES($1,$2,$3,\'Temario sintético\')', [version, course, catalog]);
    await fixture.admin.query('INSERT INTO app."CourseEdition" (id,"courseVersionId","startDate","endDate","totalSlots","availableSlots","scheduleSummary","updatedAt") VALUES($1,$2,\'2026-10-01\',\'2026-10-14\',10,5,\'Mañana\',now())', [edition, version]);
    for (let index = 0; index < reservations.length; index++) {
      // Distinct synthetic editions avoid the D4 active-reservation uniqueness rule.
      let editionId = edition;
      if (index) {
        editionId = randomUUID();
        await fixture.admin.query('INSERT INTO app."CourseEdition" (id,"courseVersionId","startDate","endDate","totalSlots","availableSlots","scheduleSummary","updatedAt") VALUES($1,$2,\'2026-10-01\',\'2026-10-14\',10,9,\'Mañana\',now())', [editionId, version]);
      }
      await fixture.admin.query('INSERT INTO app."CourseReservation" (id,"profileId","editionId","reservationNumber",status,"updatedAt") VALUES($1,$2,$3,$4,$5,now())', [reservations[index], profile, editionId, `D7-${index}`, index === 1 ? 'CANCELLED' : 'CONFIRMED']);
    }
  });
  afterAll(async () => { await fixture?.close(); });

  it('projects only participants of the managed centre and filters by course', async () => {
    const result = await service.listParticipants(manager, organization, course);
    expect(result.items.length).toBe(5);
    expect(Object.keys(result.items[0]!).sort()).toEqual(['completion', 'course_id', 'course_title', 'edition_id', 'participant_name', 'reservation_id', 'reservation_number', 'status'].sort());
    expect(await service.listParticipants(manager, organization, randomUUID())).toEqual({ items: [] });
    expect(await service.listParticipants(otherManager, otherOrganization)).toEqual({ items: [] });
  });
  it('denies another organization and candidates access to centre participants', async () => {
    await expect(service.listParticipants(otherManager, organization)).rejects.toMatchObject({ status: 404 });
    await expect(service.listParticipants(candidate, organization)).rejects.toMatchObject({ status: 404 });
  });
  it('records completion, receipt and audit atomically without accreditation or changing slots', async () => {
    const before = (await fixture.admin.query('SELECT "availableSlots" FROM app."CourseEdition" WHERE id=$1', [edition])).rows[0];
    const result = await service.recordCompletion(manager, organization, reservations[0]!, body, 'd7-completion-first-key');
    expect(result.isReplay).toBe(false);
    expect(result.completion.certificate_status).toBe('PENDING_PRIVATE_ATTACHMENT');
    expect(result.completion.decision).toBe('COMPLETED');
    expect((await fixture.admin.query('SELECT status FROM app."CourseReservation" WHERE id=$1', [reservations[0]])).rows[0].status).toBe('CONFIRMED');
    expect((await fixture.admin.query('SELECT "availableSlots" FROM app."CourseEdition" WHERE id=$1', [edition])).rows[0]).toEqual(before);
    expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."CompetencyClaim"')).rows[0].n).toBe(0);
    expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."AuditEvent" WHERE event=\'TRAINING_COMPLETION_RECORDED\'')).rows[0].n).toBe(1);
    const replay = await service.recordCompletion(manager, organization, reservations[0]!, body, 'd7-completion-first-key');
    expect(replay.isReplay).toBe(true);
    expect(replay.completion.id).toBe(result.completion.id);
    for (const [request, key] of [[{ ...body, reason: 'Otro motivo' }, 'd7-completion-first-key'], [body, 'd7-completion-another-key']] as const) {
      let failure: unknown;
      try { await service.recordCompletion(manager, organization, reservations[0]!, request, key); }
      catch (error) { failure = error; }
      expect(failure).toMatchObject({ status: 409 });
    }
  });
  it('candidate can read own completion; another candidate cannot', async () => {
    const items = (await service.listOwnCompletions(candidate)).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.course_title).toBe('Curso sintético');
    expect(items[0]?.reservation_number).toBe('D7-0');
    expect((await service.listOwnCompletions(stranger)).items).toHaveLength(0);
  });
  it('cancelled and foreign reservations cannot receive completions', async () => {
    await expect(service.recordCompletion(manager, organization, reservations[1]!, body, 'd7-completion-cancelled')).rejects.toMatchObject({ status: 409 });
    await expect(service.recordCompletion(otherManager, otherOrganization, reservations[2]!, body, 'd7-completion-foreign')).rejects.toMatchObject({ status: 404 });
  });
  it('rejects future/invalid date, invalid status and missing idempotency', async () => {
    expect(TrainingCompletionRequestSchema.safeParse({ ...body, completed_on: '2026-02-30' }).success).toBe(false);
    expect(TrainingCompletionRequestSchema.safeParse({ ...body, completed_on: '2099-01-01' }).success).toBe(false);
    expect(TrainingCompletionRequestSchema.safeParse({ ...body, expected_status: 'CANCELLED' }).success).toBe(false);
    await expect(service.recordCompletion(manager, organization, reservations[2]!, body)).rejects.toMatchObject({ status: 400 });
    await expect(service.recordCompletion(manager, organization, reservations[2]!, { ...body, completed_on: '2026-09-30' }, 'd7-completion-early-date')).rejects.toMatchObject({ status: 422 });
  });
  it('concurrent exact retry creates one immutable NOT_COMPLETED result', async () => {
    const request = { ...body, decision: 'NOT_COMPLETED' as const, reason: 'No completó la evaluación' };
    const results = await Promise.all([1, 2].map(() => service.recordCompletion(manager, organization, reservations[2]!, request, 'd7-completion-concurrent-key')));
    expect(results.map((r) => r.isReplay).sort()).toEqual([false, true]);
    expect(results[0]!.completion.id).toBe(results[1]!.completion.id);
    expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."TrainingCompletion" WHERE "reservationId"=$1', [reservations[2]])).rows[0].n).toBe(1);
  });
  it('receipt/audit failure rolls back the completion and permits retry', async () => {
    await fixture.admin.query(`CREATE FUNCTION app.fail_training_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='TRAINING_COMPLETION_RECORDED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_training_audit_test BEFORE INSERT ON app."AuditEvent" FOR EACH ROW EXECUTE FUNCTION app.fail_training_audit_test();`);
    try {
      await expect(service.recordCompletion(manager, organization, reservations[3]!, body, 'd7-completion-rollback')).rejects.toBeDefined();
      expect((await fixture.admin.query('SELECT count(*)::int AS n FROM app."TrainingCompletion" WHERE "reservationId"=$1', [reservations[3]])).rows[0].n).toBe(0);
    } finally {
      await fixture.admin.query('DROP TRIGGER fail_training_audit_test ON app."AuditEvent"; DROP FUNCTION app.fail_training_audit_test()');
    }
    expect((await service.recordCompletion(manager, organization, reservations[3]!, body, 'd7-completion-rollback')).isReplay).toBe(false);
  });
  it('revoked membership cannot replay or read a previous centre operation', async () => {
    await fixture.admin.query('UPDATE app."OrganizationMembership" SET status=\'REVOKED\' WHERE "userId"=$1', [manager.id]);
    await expect(service.listParticipants(manager, organization)).rejects.toMatchObject({ status: 404 });
    await expect(service.recordCompletion(manager, organization, reservations[0]!, body, 'd7-completion-first-key')).rejects.toMatchObject({ status: 404 });
  });
});
