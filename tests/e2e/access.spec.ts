import { test, expect } from '@playwright/test';

test.describe('D1 Access and Session E2E Flows', () => {
  test('1. Unauthenticated redirect, client validation, login user A, profile setup, account context, reload & logout', async ({ page }, testInfo) => {
    await page.goto('/inicio');
    await expect(page).toHaveURL(/.*\/acceso/);
    await expect(page.getByRole('heading', { name: 'Tu experiencia cuenta.' })).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('d1-access-light.png') });

    const emailInput = page.getByLabel('Correo electrónico', { exact: false });
    const passwordInput = page.getByLabel('Contraseña', { exact: false });
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    let apiMeRequested = false;
    page.on('request', (req) => {
      if (req.url().includes(':55437/api/v1/me')) apiMeRequested = true;
    });
    await emailInput.fill('invalid-email');
    await passwordInput.fill('short');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Introduce un correo válido.')).toBeVisible();
    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
    expect(apiMeRequested).toBe(false);

    await emailInput.fill('ana.demo@example.test');
    await passwordInput.fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();

    const createProfileBtn = page.getByRole('button', { name: 'Crear mi espacio privado' });
    const continueProfileBtn = page.getByRole('button', { name: 'Continuar construyendo mi perfil' });
    const savedProfileLink = page.getByRole('link', { name: 'Ver mi perfil guardado', exact: true });
    const beginProfileLink = page.getByRole('link', { name: 'Comenzar mi perfil', exact: true });
    await expect(createProfileBtn.or(continueProfileBtn).or(savedProfileLink).or(beginProfileLink).first()).toBeVisible();

    if (await createProfileBtn.isVisible()) {
      await createProfileBtn.click();
      await expect(page.getByText('Perfil privado creado.').or(page.getByText('Borrador de perfil en preparación'))).toBeVisible();
    }

    await page.goto('/mi-cuenta');
    await expect(page.getByText('ana.demo@example.test')).toBeVisible();
    await expect(page.getByText('Empresa Demo (RECRUITER)')).toBeVisible();
    await expect(page.getByText('Centro Demo')).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('ana.demo@example.test')).toBeVisible();

    const storedPassword = await page.evaluate(() => {
      const allVals = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? '');
      return allVals.some((v) => v.includes('Demo-test-1234'));
    });
    expect(storedPassword).toBe(false);

    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await expect(page).toHaveURL(/.*\/acceso/);
    await expect(page.getByText('ana.demo@example.test')).toHaveCount(0);
  });

  test('2. Separate context login user B sees Centro Demo and isolation', async ({ page }) => {
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('bruno.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();
    await page.goto('/mi-cuenta');
    await expect(page.getByText('bruno.demo@example.test')).toBeVisible();
    await expect(page.getByText('Centro Demo (TRAINING_MANAGER)')).toBeVisible();
    await expect(page.getByText('Empresa Demo')).toHaveCount(0);
    await expect(page.getByText('ana.demo@example.test')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await expect(page).toHaveURL(/.*\/acceso/);
  });

  test('3. Bad credentials notice, unverified signup progress and generic recovery message', async ({ page }) => {
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('WrongPassword99');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciales inválidas o no verificadas.')).toBeVisible();

    await page.getByRole('link', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/.*\/registro\/cuenta/);
    const step1 = page.locator('ol > li').first();
    await expect(step1).toHaveAttribute('aria-current', 'step');

    await page.getByLabel('Correo electrónico', { exact: false }).fill('unverified.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Revisa tu correo para confirmar tu cuenta.')).toBeVisible();
    await expect(page).toHaveURL(/.*\/registro\/cuenta/);

    await page.goto('/recuperar');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByText('Si la cuenta existe, recibirás instrucciones en tu correo.')).toBeVisible();
  });

  test('4. Mobile responsive viewports 320 and 390, dark theme, navigation and SVG geometry', async ({ page }, testInfo) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/acceso');
      await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
      await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();

      await page.getByLabel('Tema', { exact: true }).selectOption('dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(hasHorizontalOverflow).toBe(false);

      const mobileNav = page.getByRole('navigation', { name: 'Móvil' });
      await expect(mobileNav).toBeVisible();
      await expect(mobileNav.getByRole('link')).toHaveCount(4);

      const icons = mobileNav.locator('img');
      await expect(icons).toHaveCount(4);
      for (let i = 0; i < 4; i++) {
        const img = icons.nth(i);
        await img.evaluate(async (el: HTMLImageElement) => {
          if (!el.complete) {
            await new Promise((resolve) => {
              el.onload = resolve;
              el.onerror = resolve;
            });
          }
        });
        const iconGeometry = await img.evaluate((el: HTMLImageElement) => ({
          width: el.width,
          height: el.height,
          naturalWidth: el.naturalWidth,
        }));
        expect(iconGeometry.width).toBe(24);
        expect(iconGeometry.height).toBe(24);
        expect(iconGeometry.naturalWidth).toBeGreaterThan(0);
      }

      await mobileNav.getByRole('link', { name: 'Agenda' }).click();
      await expect(page).toHaveURL(/.*\/agenda/);
      await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();

      await page.goto('/mi-cuenta');
      await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();

      await page.getByLabel('Tema', { exact: true }).selectOption('light');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

      if (width === 390) {
        await page.goto('/inicio');
        await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();
        await page.getByLabel('Tema', { exact: true }).selectOption('dark');
        await page.screenshot({ path: testInfo.outputPath('d1-home-dark390.png') });
      }

      await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
      await expect(page).toHaveURL(/.*\/acceso/);
    }
  });

  test('5. Resilient recovery on 503 retry and 401 token invalidation clean exit', async ({ page }) => {
    await page.route('**/api/v1/me', async (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Servicio temporalmente no disponible',
              field_errors: [],
              retryable: true,
            },
            request_id: 'fixture',
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: false }).fill('ana.demo@example.test');
    await page.getByLabel('Contraseña', { exact: false }).fill('Demo-test-1234');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Error de carga de sesión')).toBeVisible();
    const retryBtn = page.getByRole('button', { name: 'Reintentar' });
    await expect(retryBtn).toBeVisible();

    await page.unroute('**/api/v1/me');
    await retryBtn.click();
    await expect(page.getByRole('heading', { name: 'Tu camino empieza aquí.' })).toBeVisible();

    await page.route('**/api/v1/me', async (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'AUTH_REQUIRED',
              message: 'Sesión no válida o expirada',
              field_errors: [],
              retryable: false,
            },
            request_id: 'fixture',
          }),
        });
      }
      return route.continue();
    });

    await page.reload();
    await expect(page).toHaveURL(/.*\/acceso/);
    await expect(page.getByRole('heading', { name: 'Tu experiencia cuenta.' })).toBeVisible();
    await expect(page.getByText('ana.demo@example.test')).toHaveCount(0);
  });
});
