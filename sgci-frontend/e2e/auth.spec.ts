import { test, expect } from '@playwright/test';

/**
 * Connexion — smoke de bout en bout.
 *
 * Ces tests pilotent l'interface reelle (le serveur de developpement est
 * lance par Playwright, webServer dans playwright.config.ts) et l'API Laravel
 * (base SQLite locale, dotee par les seeders : gerant@sgci.bj / password).
 *
 * Ils remplacent les specifications e2e ecrites en juin, qui n'avaient jamais
 * ete executees : leurs selecteurs (input[name="email"], h1 « Connexion »)
 * ne correspondaient plus a l'interface actuelle, et leurs expectations
 * (message « Email est requis ») a un comportement qui n'existe plus — le
 * formulaire est desormais valide par le navigateur (attribut `required`).
 *
 * Les ancres utilisees sont des `data-testid` : elles ne dependent ni du
 * texte, ni de la structure visuelle, ni de la classe CSS.
 */

const GERANT = {
  email: 'gerant@sgci.bj',
  password: 'password',
};

test.describe('Connexion', () => {
  test('la page de connexion affiche le formulaire', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });

  test('un formulaire vide ne connecte pas', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-submit').click();

    // Les deux champs sont `required` : le navigateur bloque la soumission,
    // l'URL ne bouge pas. Aucune requete ne part vers l'API.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('des identifiants valides ouvrent l application', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill(GERANT.email);
    await page.getByTestId('login-password').fill(GERANT.password);
    await page.getByTestId('login-submit').click();

    // Un compte peut avoir plusieurs boutiques : la redirection est alors
    // l'ecran de selection, le tableau de bord sinon. Les deux sont acceptes.
    // `toHaveURL` et non `waitForURL` : le routing de Next est cote client
    // (pushState), il ne declenche aucune navigation — `waitForURL` attend un
    // evenement de navigation qui ne vient jamais.
    await expect(page).toHaveURL(/\/(dashboard|selection-boutique)/, { timeout: 30000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('des identifiants errones sont refuses', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill('inconnu@sgci.bj');
    await page.getByTestId('login-password').fill('mauvais-mot-de-passe');
    await page.getByTestId('login-submit').click();

    // L'echec est signale par un toast (sonner) et l'URL reste sur /login.
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
