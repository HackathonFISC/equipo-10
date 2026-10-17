import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

test('A02 shows processing once, interview questions and a sourced follow-up', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const originalSource = crypto.randomUUID();
  const answerSource = crypto.randomUUID();
  let sourceCalls = 0;
  let interpretationCalls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const requests: any[] = [];
  const saves: any[] = [];
  await page.route('**/api/v1/me/profile-sources', async (route) => {
    sourceCalls++;
    await route.fulfill({ json: { data: { id: sourceCalls === 1 ? originalSource : answerSource, version: 1, status: 'READY', fragments_count: 1 } } });
  });
  await page.route('**/api/v1/me/profile-interpretation-grants', async (route) => {
    await route.fulfill({ json: { data: { grant_id: crypto.randomUUID() } } });
  });
  await page.route('**/api/v1/me/profile-interpretations', async (route) => {
    interpretationCalls++;
    const body = route.request().postDataJSON();
    requests.push(body);
    if (interpretationCalls === 1) await pending;
    await route.fulfill({ status: 202, json: { data: {
      run_id: crypto.randomUUID(), status: 'succeeded', goal: body.goal,
      draft_ref: { id: body.draft_id, revision: 1 }, agent_id: 'A02', contract_version: 'agent-result/1',
      suggestions: interpretationCalls === 1 ? [] : [{ suggestion_id: crypto.randomUUID(), section: 'EXPERIENCE', field: 'experience_entry', proposed_value: { title: 'Atención en tienda familiar', description: 'Atendía clientes y organizaba productos.', start_month: '2024' }, source_refs: [answerSource], rationale: 'Atendía clientes y organizaba productos.', confidence: 0.8 },
        { suggestion_id: crypto.randomUUID(), section: 'TRAINING', field: 'training_entry', proposed_value: { name: 'Curso de computación', provider_name: 'Centro Demo', completed_on: '2025' }, source_refs: [answerSource], rationale: 'Fuente de prueba.', confidence: 0.8 },
        { suggestion_id: crypto.randomUUID(), section: 'COMPETENCIES', field: 'competency_entry', proposed_value: { name: 'Atención al cliente' }, source_refs: [answerSource], rationale: 'Fuente de prueba.', confidence: 0.8 }],
      missing_fields: interpretationCalls === 1 ? ['experience.tasks'] : [],
      questions: interpretationCalls === 1 ? [{ field: 'experience.tasks', text: '¿Qué tareas hacías en la tienda?' }, { field: 'experience.start_month', text: '¿Cuándo empezaste, aproximadamente?' }] : [],
      created_at: new Date().toISOString(),
    } } });
  });
  await page.route('**/api/v1/me/candidate-profile/draft/suggestion-decisions', async (route) => {
    saves.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] });
    if (saves.length === 1) {
      await route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'No pudimos comprobar el guardado. Reintenta.', field_errors: [], retryable: true }, request_id: 'test' } });
      return;
    }
    await route.fulfill({ json: { data: { new_revision: 2, accepted_count: 1 } } });
  });
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
  await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();
  await page.goto('/perfil/trayectoria');
  await page.getByRole('button', { name: /Leer mi CV o contar mi experiencia/ }).click();
  await page.getByLabel('Describe tus actividades', { exact: false }).fill('Ayudaba en la tienda de mi familia.');
  await page.getByRole('button', { name: 'Empezar la revisión' }).click();
  await expect(page.getByText('Estamos leyendo tu información y preparando las preguntas…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisión en curso…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cerrar modal' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cargar CV en PDF' })).toBeDisabled();
  expect(interpretationCalls).toBe(1);
  release();
  await expect(page.getByRole('heading', { name: 'Lo que encontramos' })).toBeVisible();
  await page.getByRole('button', { name: 'Completar con preguntas' }).click();
  await expect(page.getByLabel('¿Qué tareas hacías en la tienda?')).toBeVisible();
  await page.getByLabel('¿Qué tareas hacías en la tienda?').fill('Atendía clientes y organizaba productos.');
  await page.screenshot({ path: testInfo.outputPath('a02-one-question-light.png') });
  await page.getByRole('button', { name: 'Siguiente pregunta' }).click();
  await expect(page.getByLabel('¿Cuándo empezaste, aproximadamente?')).toBeVisible();
  await page.getByRole('button', { name: 'No lo recuerdo' }).click();
  await page.getByRole('button', { name: 'Usar mis respuestas' }).click();
  await expect(page.getByRole('heading', { name: 'Elegir tus datos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atención en tienda familiar' })).toBeVisible();
  expect(requests[1].goal).toBe('clarify_profile');
  expect(requests[1].source_refs).toEqual([{ id: originalSource, version: 1 }, { id: answerSource, version: 1 }]);
  await expect(page.getByRole('radio', { name: 'Dejar pendiente' })).toBeChecked();
  await expect(page.getByText('experience.tasks', { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Tema', { exact: true }).selectOption('dark');
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole('heading', { name: 'Atención en tienda familiar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('a02-review-dark320.png') });
  await page.getByRole('radio', { name: 'Sí, añadir' }).check();
  await page.getByRole('button', { name: 'Siguiente dato' }).click();
  await expect(page.getByRole('heading', { name: 'Atención en tienda familiar' })).toBeVisible();
  expect(saves).toHaveLength(0);
  await page.getByLabel('Tipo de experiencia', { exact: true }).selectOption('INFORMAL');
  await page.getByRole('button', { name: 'Dejar fechas pendientes', exact: true }).click();
  await expect(page.getByLabel('Mes de inicio (opcional)', { exact: true })).toHaveValue('');
  await page.getByLabel('Actividad o puesto', { exact: true }).fill('Atención al público en tienda familiar');
  await page.getByRole('button', { name: 'Siguiente dato' }).click();
  await expect(page.getByRole('heading', { name: 'Curso de computación' })).toBeVisible();
  await page.getByRole('radio', { name: 'Sí, añadir' }).check();
  await page.getByRole('button', { name: 'Dejar fecha pendiente', exact: true }).click();
  await expect(page.getByLabel('Fecha de finalización (opcional)', { exact: true })).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('radio', { name: 'No corresponde' }).check();
  await page.getByRole('button', { name: 'Siguiente dato' }).click();
  await expect(page.getByText('Esta habilidad queda como sugerencia', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ver resumen' }).click();
  await expect(page.getByRole('heading', { name: 'Vas a añadir 1 dato' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('a02-final-summary-dark.png') });
  await page.getByRole('button', { name: 'Cambiar mis elecciones' }).click();
  await expect(page.getByRole('radio', { name: 'Sí, añadir' })).toBeChecked();
  await page.getByRole('button', { name: 'Siguiente dato' }).click();
  await expect(page.getByRole('radio', { name: 'No corresponde' })).toBeChecked();
  await page.getByRole('button', { name: 'Siguiente dato' }).click();
  await page.getByRole('button', { name: 'Ver resumen' }).click();
  const save = page.getByRole('button', { name: 'Añadir al borrador y seguir editando' });
  await save.click();
  await expect(page.getByText('No pudimos comprobar el guardado. Reintenta.')).toBeVisible();
  await save.click();
  await expect(page.getByRole('heading', { name: 'Experiencia laboral y actividades' })).toBeVisible();
  expect(saves).toHaveLength(2);
  expect(saves[0].key).toBe(saves[1].key);
  expect(saves[0].body).toEqual(saves[1].body);
  expect(saves[1].body.decisions.map((item: any) => item.decision)).toEqual(['accept', 'reject', 'defer']);
  expect(saves[1].body.decisions[0].replacement_value.title).toBe('Atención al público en tienda familiar');
  expect(saves[1].body.decisions[0].replacement_value.start_month).toBeNull();
  await expect(page.getByRole('button', { name: '+ Agregar experiencia', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('a02-manual-continuation-dark.png') });
});

test('PDF selection survives session refresh; processing stays below and retries without reupload', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const sourceId = crypto.randomUUID();
  let uploads = 0, analyses = 0;
  let releaseAnalysis!: () => void;
  const pendingAnalysis = new Promise<void>((resolve) => { releaseAnalysis = resolve; });
  let releaseMe!: () => void;
  const pendingMe = new Promise<void>((resolve) => { releaseMe = resolve; });
  let refreshing = false;
  await page.route('**/auth/v1/token?grant_type=refresh_token', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const [header, payload] = data.access_token.split('.');
    const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), jti: crypto.randomUUID() })).toString('base64url');
    const signature = createHmac('sha256', 'fixture-test-secret-32-chars-long-d1').update(`${header}.${changed}`).digest('base64url');
    await route.fulfill({ json: { ...data, access_token: `${header}.${changed}.${signature}` } });
  });
  await page.route('**/api/v1/me', async (route) => {
    if (refreshing) await pendingMe;
    await route.continue();
  });
  await page.route('**/api/v1/me/profile-sources', async (route) => {
    uploads++;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    await route.fulfill({ json: { data: { id: sourceId, version: 1, status: 'READY', fragments_count: 1 } } });
  });
  await page.route('**/api/v1/me/profile-interpretation-grants', (route) => route.fulfill({ json: { data: { grant_id: crypto.randomUUID() } } }));
  await page.route('**/api/v1/me/profile-interpretations', async (route) => {
    analyses++;
    if (analyses === 1) {
      await pendingAnalysis;
      await route.fulfill({ status: 502, json: { error: { code: 'A02_INCOMPLETE_RESULT', message: 'El análisis se interrumpió antes de terminar.', field_errors: [], retryable: true }, request_id: 'fixture' } });
      return;
    }
    const body = route.request().postDataJSON();
    await route.fulfill({ json: { data: { run_id: crypto.randomUUID(), status: 'succeeded', goal: body.goal,
      draft_ref: { id: body.draft_id, revision: 1 }, agent_id: 'A02', contract_version: 'agent-result/1',
      suggestions: [], missing_fields: [], questions: [{ field: 'tasks', text: '¿Qué tareas disfrutabas más?' }], created_at: new Date().toISOString() } } });
  });
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
  await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();
  await page.goto('/perfil/trayectoria');
  await page.getByRole('button', { name: /Leer mi CV o contar mi experiencia/ }).click();
  await page.getByRole('button', { name: 'Cargar CV en PDF' }).click();
  await page.locator('#file-upload-input').setInputFiles({ name: 'CV-demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic browser fixture') });
  refreshing = true;
  await page.evaluate(async () => {
    const path = '/src/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ path);
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Archivo seleccionado: CV-demo.pdf', { exact: false })).toBeVisible();
  refreshing = false; releaseMe();
  await page.getByRole('button', { name: 'Empezar la revisión' }).click();
  const busy = page.getByRole('button', { name: 'Revisión en curso…' });
  await expect(busy).toBeDisabled();
  await expect(page.locator('footer #source-processing-status')).toBeVisible();
  await busy.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  expect(analyses).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('a02-pdf-processing-footer.png') });
  releaseAnalysis();
  await expect(page.getByRole('alert')).toContainText('El análisis se interrumpió');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar la revisión' }).click();
  await expect(page.getByRole('heading', { name: 'Lo que encontramos' })).toBeVisible();
  expect(uploads).toBe(1);
  expect(analyses).toBe(2);
});
