import { test, expect } from '@playwright/test';

test.describe('D3 Opportunities Exploration, Deterministic Matching C01 & A03 AI Orientation Flow', () => {
  test.beforeAll(async ({ request }) => {
    // 1. Obtener token de autenticación para Bruno
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
      headers: { ...authHeaders, 'Idempotency-Key': 'bruno-seed-draft-00000000001' },
      data: {},
    });

    if (draftRes.status() === 201) {
      const { data: draft } = await draftRes.json();

      // 4. Configurar datos de perfil y restricciones logísticas
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

      // 5. Completar revisiones humanas obligatorias por las guardas SQL
      for (const section of ['ACCOUNT', 'EXPERIENCE', 'TRAINING', 'INTERESTS', 'COMPETENCIES', 'AVAILABILITY', 'CONSTRAINTS', 'FINAL_REVIEW']) {
        await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft/section-reviews', {
          headers: { ...authHeaders, 'Idempotency-Key': `rev-bruno-${section.toLowerCase()}-001` },
          data: { section, decision: 'REVIEWED' },
        });
      }

      // 6. Generar snapshot preview
      const previewRes = await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft/review-previews', {
        headers: { ...authHeaders, 'If-Match': '3', 'Idempotency-Key': 'prev-bruno-key-00000000001' },
        data: {},
      });
      const previewJson = await previewRes.json();

      const draftCurRes = await request.get('http://127.0.0.1:55437/api/v1/me/candidate-profile/draft', { headers: authHeaders });
      const curRev = (await draftCurRes.json()).data.revision;

      // 7. Confirmar perfil oficialmente
      const confirmRes = await request.post('http://127.0.0.1:55437/api/v1/me/candidate-profile/confirmations', {
        headers: { ...authHeaders, 'If-Match': String(curRev), 'Idempotency-Key': 'conf-bruno-key-00000000001' },
        data: {
          draft_id: draft.id,
          preview_id: previewJson.data.preview_id,
          acknowledge_partial: true,
        },
      });
      expect(confirmRes.status()).toBe(201);
    }
  });

  test('Complete journey: Explore -> Filter -> View Detail -> C01 Match -> A03 AI Explanation -> Dashboard', async ({ page }, testInfo) => {
    test.setTimeout(90000);

    // 1. Iniciar sesión con usuario Bruno (perfil confirmado)
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('bruno.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible({ timeout: 15000 });

    // 2. Comprobar tarjeta de próxima acción en el Inicio (D3-5)
    await expect(page.getByText('Próxima acción recomendada')).toBeVisible();
    await expect(page.getByText('Explorar vacantes compatibles')).toBeVisible();

    // 3. Navegar a /explorar usando el botón del Inicio
    await page.getByRole('button', { name: 'Explorar oportunidades de empleo' }).click();
    await page.waitForURL(/.*\/explorar/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Explorar oportunidades/i })).toBeVisible({ timeout: 15000 });

    // 4. Verificar presencia de la vacante demo
    const card = page.getByTestId('opportunity-card-e0000000-0000-4000-a000-000000000001');
    const vacancyHeading = page.getByRole('heading', { name: 'Auxiliar de Bodega e Inventario' });
    await expect(vacancyHeading).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Empresa Demo')).toBeVisible();
    await expect(card.getByText('Demo', { exact: true })).toBeVisible();
    await expect(card.getByText('Presencial', { exact: true })).toBeVisible();

    // Tomar captura del explorador
    await page.screenshot({ path: testInfo.outputPath('d3-explorer-catalog.png') });

    // 5. Probar filtros interactivos
    const searchInput = page.getByPlaceholder('Buscar por título o palabra clave...');
    await searchInput.fill('Astronauta Inexistente');
    await expect(page.getByText('No se encontraron oportunidades')).toBeVisible({ timeout: 5000 });

    await searchInput.fill('');
    await expect(vacancyHeading).toBeVisible({ timeout: 5000 });

    // 6. Entrar al detalle de la vacante haciendo clic en la tarjeta
    await card.click();
    await page.waitForURL(/.*\/explorar\/[a-f0-9-]+/, { timeout: 15000 });

    // 7. Verificar detalle de la vacante
    await expect(page.getByRole('heading', { name: 'Auxiliar de Bodega e Inventario' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Responsable del conteo de existencias y estiba de pedidos en sucursal.')).toBeVisible();
    await expect(page.getByText(/\$650(\.00)? USD \/ mes/i)).toBeVisible();

    // Verificar desglose de requisitos de entrada vs entrenables
    await expect(page.getByText('Registro de inventario')).toBeVisible();
    await expect(page.getByText('Requisitos de entrada')).toBeVisible();
    await expect(page.getByText('Esencial').first()).toBeVisible();

    await expect(page.getByText('Manejo de transpaleta manual')).toBeVisible();
    await expect(page.getByText('Requisitos entrenables en el puesto')).toBeVisible();

    // 8. Configurar supuestos y ejecutar cálculo determinístico C01
    const commuteInput = page.getByLabel('Tiempo estimado de traslado de ida (minutos)');
    await commuteInput.fill('35');

    const compareBtn = page.getByRole('button', { name: 'Comparar con mi perfil confirmado' });
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // 9. Verificar renderizado del resultado C01 (ComparisonResultsCard)
    const feasibilityBadge = page.getByText(/VIABLE|PENDIENTE|INVIABLE/i).first();
    await expect(feasibilityBadge).toBeVisible({ timeout: 15000 });

    // Verificar presencia de métricas y desglose sin alucinaciones
    await expect(page.getByText(/Condiciones logísticas/i)).toBeVisible();
    await expect(page.getByText('Desglose de competencias y requisitos')).toBeVisible();

    // Tomar captura del resultado de comparación C01
    await page.screenshot({ path: testInfo.outputPath('d3-comparison-c01-result.png') });

    // 10. Solicitar Explicación con Agente A03 (Vertex AI / Deterministic Fallback)
    const requestExplanationBtn = page.getByRole('button', { name: 'Explicar resultado con Orientador IA (A03)' });
    await expect(requestExplanationBtn).toBeVisible();
    await requestExplanationBtn.click();

    // 11. Verificar panel de explicación de A03
    await expect(page.getByText('Orientación personalizada A03')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('Gemini 3.8 Flash (Vertex AI)')).toBeVisible();
    await expect(page.getByText('Explicación clara')).toBeVisible();

    // Tomar captura de la explicación de orientación
    await page.screenshot({ path: testInfo.outputPath('d3-a03-orientation-result.png') });

    // 12. Regresar al Inicio y verificar que la comparación reciente aparece en el feed
    await page.goto('/inicio');
    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible({ timeout: 15000 });

    // Verificar en actividad reciente
    await expect(page.getByText(/Últimas evaluaciones de compatibilidad calculadas con rigor determinístico C01:/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /Ver detalle →/i }).first()).toBeVisible();

    // Tomar captura final del dashboard con actividad reciente
    await page.screenshot({ path: testInfo.outputPath('d3-home-recent-activity.png') });
  });
});
