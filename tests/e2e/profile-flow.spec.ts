import { test, expect } from '@playwright/test';

test.describe('D2 Candidate Profile 4-Step Registration and Confirmation E2E Flow', () => {
  test('Completes Account -> Experience -> Availability -> Review & Confirmation', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    // 1. Iniciar sesión con usuario fixture de prueba
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible({ timeout: 15000 });

    // 2. Navegar a /perfil/cuenta (Paso 1)
    await page.goto('/perfil/cuenta');
    await expect(page.getByRole('heading', { name: 'Empezar por lo esencial.' })).toBeVisible({ timeout: 15000 });

    const nameInput = page.getByLabel('Nombre para tu perfil');
    const headlineInput = page.getByLabel('Titular profesional o breve descripción');

    await expect(nameInput).toBeVisible();
    await nameInput.fill('Ana María Gómez');
    await headlineInput.fill('Asistente Administrativa y Atención al Cliente');
    await page.getByRole('button', { name: /Continuar a mi experiencia/i }).click();

    // 3. Paso 2: Trayectoria e Intereses
    await page.waitForURL(/.*\/perfil\/trayectoria/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Tus experiencias cuentan.' })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '+ Agregar experiencia', exact: true }).click();
    await page.getByLabel('Puesto, rol o labor realizada', { exact: false }).fill('Apoyo en comercio familiar');
    await page.getByLabel('¿Qué tareas hacías o qué aprendiste?', { exact: false }).fill('Organizaba productos y atendía consultas.');
    await page.getByRole('button', { name: 'Guardar en lista', exact: true }).click();

    // Guardar y avanzar a disponibilidad
    const continueExpBtn = page.getByRole('button', { name: /Guardar y continuar a Disponibilidad/i });
    await expect(continueExpBtn).toBeVisible({ timeout: 15000 });
    await continueExpBtn.click();

    // 4. Paso 3: Disponibilidad y Logística
    await page.waitForURL(/.*\/perfil\/disponibilidad/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Tus tiempos, movilidad y expectativas.' })).toBeVisible({ timeout: 15000 });
    await page.goto('/inicio');
    await page.getByRole('link', { name: 'Ver mi perfil guardado', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Apoyo en comercio familiar', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Apoyo en comercio familiar', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Editar experiencia, cursos e intereses', exact: true }).click();
    await expect(page.getByText('Apoyo en comercio familiar', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Guardar y continuar a Disponibilidad/i }).click();

    const continueAvailBtn = page.getByRole('button', { name: /Guardar y continuar a Revisión/i });
    await expect(continueAvailBtn).toBeVisible({ timeout: 15000 });
    await continueAvailBtn.click();

    // 5. Paso 4: Revisión y Confirmación
    await page.waitForURL(/.*\/perfil\/revision/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Revisa tu perfil antes de confirmar.' })).toBeVisible({ timeout: 15000 });

    // Tomar captura del snapshot de revisión
    await page.screenshot({ path: testInfo.outputPath('d2-review-step.png') });

    // Verificar presencia del banner de snapshot y hash SHA-256
    await expect(page.getByText('Snapshot temporal de revisión')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Hash:/i)).toBeVisible({ timeout: 15000 });

    // Si requiere acknowledge partial, marcar el checkbox
    const acknowledgeCheckbox = page.getByRole('checkbox');
    if (await acknowledgeCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acknowledgeCheckbox.check();
    }

    // Confirmar perfil
    const confirmBtn = page.getByRole('button', { name: 'Confirmar Perfil Oficial' });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 6. Verificar recibo emitido y enlace al inicio
    await expect(page.getByText('¡Perfil confirmado exitosamente!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Versión oficial: Versión 1')).toBeVisible();
    await expect(page.getByText(/Recibo auditable:/i)).toBeVisible();

    // Ir a Inicio
    await page.getByRole('button', { name: /Ir al Inicio/i }).click();
    await page.waitForURL(/.*\/inicio/);
    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();
    let newDrafts = 0;
    await page.route('**/api/v1/me/candidate-profile/drafts', async (route) => { newDrafts++; await route.continue(); });
    await page.getByRole('link', { name: 'Ver mi perfil guardado', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi perfil guardado' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ana María Gómez', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apoyo en comercio familiar', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ana María Gómez', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Tema', { exact: true }).selectOption('dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('saved-profile-dark390.png'), fullPage: true });
    await page.goto('/perfil/cuenta');
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole('heading', { name: 'Ana María Gómez', exact: true })).toBeVisible();
    expect(newDrafts).toBe(0);

    // 7. Re-editar perfil confirmado: Iniciar nueva versión mutable basada en Versión 1
    const editProfileBtn = page.getByRole('button', { name: /Editar perfil o agregar información/i });
    await expect(editProfileBtn).toBeVisible();
    await editProfileBtn.click();

    // Redirige a /perfil/trayectoria con los datos clonados de la versión confirmada
    await page.waitForURL(/.*\/perfil\/trayectoria/, { timeout: 15000 });
    await expect(page.getByText('Apoyo en comercio familiar', { exact: true })).toBeVisible();

    // Agregar una segunda experiencia mediante formulario manual
    await page.getByRole('button', { name: '+ Agregar experiencia', exact: true }).click();
    await page.getByLabel('Puesto, rol o labor realizada', { exact: false }).fill('Asistente de inventario');
    await page.getByLabel('¿Qué tareas hacías o qué aprendiste?', { exact: false }).fill('Control de stock, empaque y despacho de pedidos.');
    await page.getByRole('button', { name: 'Guardar en lista', exact: true }).click();
    await expect(page.getByText('Asistente de inventario', { exact: true })).toBeVisible();

    // Avanzar a disponibilidad y luego a revisión
    await page.getByRole('button', { name: /Guardar y continuar a Disponibilidad/i }).click();
    await page.waitForURL(/.*\/perfil\/disponibilidad/, { timeout: 15000 });
    await page.getByRole('button', { name: /Guardar y continuar a Revisión/i }).click();

    // Revisar snapshot de Versión 2
    await page.waitForURL(/.*\/perfil\/revision/, { timeout: 15000 });
    await expect(page.getByText('2 experiencia(s) registrada(s)')).toBeVisible();

    const ackCheckboxV2 = page.getByRole('checkbox');
    if (await ackCheckboxV2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ackCheckboxV2.check();
    }

    // Confirmar Versión 2
    const confirmV2Btn = page.getByRole('button', { name: 'Confirmar Perfil Oficial' });
    await expect(confirmV2Btn).toBeEnabled();
    await confirmV2Btn.click();

    // Verificar recibo de Versión 2
    await expect(page.getByText('¡Perfil confirmado exitosamente!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Versión oficial: Versión 2')).toBeVisible();

    // Volver a inicio y consultar perfil guardado oficial
    await page.getByRole('button', { name: /Ir al Inicio/i }).click();
    await page.waitForURL(/.*\/inicio/);
    await page.getByRole('link', { name: 'Ver mi perfil guardado', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Mi perfil guardado' })).toBeVisible();
    await expect(page.getByText('Perfil confirmado · Versión 2.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apoyo en comercio familiar', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Asistente de inventario', exact: true })).toBeVisible();
  });
});

