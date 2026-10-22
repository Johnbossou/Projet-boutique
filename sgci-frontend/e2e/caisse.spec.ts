import { test, expect } from '@playwright/test';

/**
 * Caisse — smoke de bout en bout.
 *
 * La caisse est l'ecran le plus utilise de l'application : il doit
 * s'ouvrir pour un gerant connecte, et proposer la recherche produits.
 * Le parcours d'encaissement complet (ajout au panier, remise, paiement,
 * ticket) n'est pas couvert ici : il depend du stock, du mode de paiement et
 * des montants de la vente — un tel test serait instable en CI. Cette
 * couverture appartient a des tests d'integration, pas a un smoke de
 * disponibilite.
 */

const GERANT = {
  email: 'gerant@sgci.bj',
  password: 'password',
};

test.describe('Caisse', () => {
  test('la caisse s affiche pour un gerant connecte', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(GERANT.email);
    await page.getByTestId('login-password').fill(GERANT.password);
    await page.getByTestId('login-submit').click();
    // Routing cote client : `toHaveURL` scrute l'URL, `waitForURL` attendrait
    // un evenement de navigation qui ne se produit pas.
    await expect(page).toHaveURL(/\/(dashboard|selection-boutique)/, { timeout: 30000 });

    await page.goto('/caisse');

    await expect(page.getByRole('heading', { name: 'Caisse Gaming' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder('Rechercher un produit...')).toBeVisible({ timeout: 20000 });
  });
});
