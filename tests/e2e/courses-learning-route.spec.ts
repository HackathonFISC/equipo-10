import { test, expect } from '@playwright/test';

test.describe('D4 Courses, Learning Route & Safe Reservation Flow', () => {
  test.beforeAll(async ({ request }) => {
    // 1. Obtener token para Bruno
    const authRes = await request.post('http://127.0.0.1:55438/auth/v1/token?grant_type=password', {
      data: {
        email: 'bruno.demo@example.test',
        password: 'Demo-test-1234',
      },
    });
    const authJson = await authRes.json();
    const token = authJson.access_token;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 2. Inicializar usuario y perfil de candidato
    await request.put('http://127.0.0.1:55437/api/v1/me', { headers: authHeaders, data: {} });
    await request.put('http://127.0.0.1:55437/api/v1/me/candidate-profile', { headers: authHeaders, data: {} });

    // 3. Crear borrador para Bruno
    const draftRes = await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/drafts', {
      headers: { ...authHeaders, 'Idempotency-Key': 'bruno-d4-seed-draft-00000000001' },
      data: {},
    });

    if (draftRes.status() === 201) {
      const { data: draft } = await draftRes.json();

      await request.patch('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft', {
        headers: { ...authHeaders, 'If-Match': '1' },
        data: {
          section: 'identity',
          values: { display_name: 'Bruno Demo', headline: 'Auxiliar de Logística' },
        },
      });

      await request.patch('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft', {
        headers: { ...authHeaders, 'If-Match': '2' },
        data: {
          section: 'constraints',
          values: {
            salary_state: 'KNOWN',
            minimum_salary: '600.00',
            salary_currency: 'USD',
            salary_period: 'MONTH',
            travel_limit_state: 'KNOWN',
            max_one_way_minutes: 45,
            location_state: 'UNKNOWN',
            availability_state: 'UNKNOWN',
            mobility_state: 'UNKNOWN',
            transport_state: 'UNKNOWN',
            training_state: 'UNKNOWN',
          },
        },
      });

      for (const section of ['ACCOUNT', 'EXPERIENCE', 'TRAINING', 'INTERESTS', 'COMPETENCIES', 'AVAILABILITY', 'CONSTRAINTS', 'FINAL_REVIEW']) {
        await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft/section-reviews', {
          headers: { ...authHeaders, 'Idempotency-Key': `rev-bruno-d4-${section.toLowerCase()}-001` },
          data: { section, decision: 'REVIEWED' },
        });
      }

      const previewRes = await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft/review-previews', {
        headers: { ...authHeaders, 'If-Match': '3', 'Idempotency-Key': 'prev-bruno-d4-key-00000000001' },
        data: {},
      });
      const previewJson = await previewRes.json();

      const draftCurRes = await request.get('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft', { headers: authHeaders });
      const curRev = (await draftCurRes.json()).data.revision;

      await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/confirmations', {
        headers: { ...authHeaders, 'If-Match': String(curRev), 'Idempotency-Key': 'conf-bruno-d4-key-00000000001' },
        data: {
          draft_id: draft.id,
          preview_id: previewJson.data.preview_id,
          acknowledge_partial: true,
        },
      });
    }
  });

  test('User can browse courses catalog, view detail, view learning route and access agenda', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Iniciar sesión con usuario Bruno
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('bruno.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible({ timeout: 15000 });

    // 2. Navigate to /cursos
    await page.getByRole('link', { name: 'Cursos' }).click();
    await page.waitForURL('**/cursos', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Explorar cursos formativos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Gestión de Inventarios y Almacén').first()).toBeVisible({ timeout: 10000 });

    // 3. Navigate to Course Detail
    await page.getByText('Ver detalle y ediciones →').first().click();
    await page.waitForURL('**/cursos/**', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Gestión de Inventarios y Almacén' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Ediciones convocadas/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sede Central').first()).toBeVisible({ timeout: 10000 });

    // 4. Reserve a slot
    await page.getByRole('button', { name: 'Reservar plaza' }).first().click();
    await page.waitForURL('**/mi-ruta/reservar**', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Confirmación de Reserva' })).toBeVisible({ timeout: 10000 });

    // Click confirm reservation button
    await page.getByRole('button', { name: 'Confirmar reserva de plaza' }).click();
    await expect(page.getByText(/¡Reserva confirmada con éxito!/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Número de reserva:/i)).toBeVisible({ timeout: 10000 });

    // 5. Navigate to /agenda and check confirmed class is displayed
    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await page.waitForURL('**/agenda', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Mi Agenda de Formación' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Gestión de Inventarios y Almacén').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Aula 10').first()).toBeVisible({ timeout: 10000 });

    // 6. Navigate to /mi-ruta
    await page.getByRole('link', { name: 'Mi Ruta', exact: true }).click();
    await page.waitForURL('**/mi-ruta', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Mi ruta formativa' })).toBeVisible({ timeout: 10000 });
  });
});
