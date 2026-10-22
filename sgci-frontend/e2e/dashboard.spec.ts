import { test, expect } from '@playwright/test';

/**
 * Tableau de bord et catalogue — smoke de bout en bout.
 *
 * Meme principe que auth.spec.ts : piloter l'interface reelle, avec des
 * ancres stables. Le dashboard est verifie a travers son titre (il porte le
 * nom de l'utilisateur connecte) et le catalogue a travers la recherche et
 * l'etat vide — jamais a travers le contenu exact d'une ligne, qui depend
 * des donnees seedees.
 */

const GERANT = {
  email: 'gerant@sgci.bj',
  password: 'password',
};

async function connecter(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(GERANT.email);
  await page.getByTestId('login-password').fill(GERANT.password);
  await page.getByTestId('login-submit').click();

  // Routing cote client : `toHaveURL` scrute l'URL, `waitForURL` attendrait
  // un evenement de navigation qui ne se produit pas.
  await expect(page).toHaveURL(/\/(dashboard|selection-boutique)/, { timeout: 30000 });
}

test.describe('Tableau de bord', () => {
  test('le tableau de bord s affiche pour un gerant connecte', async ({ page }) => {
    await connecter(page);

    await page.goto('/dashboard');

    // Le titre porte le nom de l'utilisateur : il change avec le compte
    // connecte, mais sa presence prouve que le profil est charge.
    await expect(page.locator('h1')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Bonjour,/)).toBeVisible({ timeout: 20000 });
  });

  test('le catalogue des produits est consultable', async ({ page }) => {
    await connecter(page);

    await page.goto('/produits');

    const recherche = page.getByPlaceholder('Rechercher un produit...');
    await expect(recherche).toBeVisible({ timeout: 20000 });

    // Une recherche sans correspondance doit aboutir a l'etat vide, pas a une
    // erreur : c'est le comportement attendu de la recherche cote serveur.
    await recherche.fill('zzz-produit-inexistant-zzz');
    await expect(page.getByText('Aucun produit trouvé').first()).toBeVisible({ timeout: 20000 });
  });
});
