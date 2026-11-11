import { test, expect } from '@playwright/test';
import { IDENTIFIANTS_PROPRIETAIRE } from './identifiants';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Parcours des écrans — de la connexion à la dernière page.
 *
 * Ce test ne verifie pas le contenu de chaque page (les tests existants le
 * font pour les écrans principaux) mais ce qui se passe **pendant** leur
 * chargement : les erreurs de la console et les requetes en echec.
 *
 * Pourquoi c'est utile : une page qui s'affiche quand meme, en silence, avec
 * une requete 500 ou une exception React, passe tous les tests d'existence.
 * Le symptome n'apparait que dans la console du navigateur — et l'utilisateur
 * voit une page a moitie vide. Ce test le rend visible.
 *
 * La connexion est faite une seule fois pour tout le parcours : le jeton
 * est reutilise d'un ecran a l'autre. Se reconnecter a chaque page
 * multiplierait les appels a /api/login par le nombre d'ecrans, et
 * s'approcherait du limiteur de debit (throttle:30,1) de l'API — un test
 * qui echoue sur une infra qu'il a lui-meme provoque.
 */

/**
 * Le parcours se fait avec le proprietaire : c'est le seul role qui accede
 * a toutes les ecrans (la page « Mes Boutiques » est reservee aux
 * proprietaires, et son menu est masque pour un gerant). Avec un gerant, la
 * page repond 403 — un comportement correct, mais un ecran que le parcours
 * ne peut pas visiter.
 */
const COMPTE = IDENTIFIANTS_PROPRIETAIRE;

/**
 * Etat de session partage : il est produit par la connexion de `beforeAll`,
 * puis reutilise ecran par ecran.
 */
const ETAT_SESSION = 'storage/e2e-session.json';

const ECRANS: { chemin: string; nom: string }[] = [
  { chemin: '/dashboard', nom: 'Tableau de bord' },
  { chemin: '/clients', nom: 'Clients' },
  { chemin: '/produits', nom: 'Produits' },
  { chemin: '/commandes-clients', nom: 'Commandes clients' },
  { chemin: '/commandes-fournisseurs', nom: 'Commandes fournisseurs' },
  { chemin: '/fidelite', nom: 'Fidelite' },
  { chemin: '/caisse', nom: 'Caisse' },
  { chemin: '/devis', nom: 'Devis' },
  { chemin: '/factures', nom: 'Factures' },
  { chemin: '/inventaire', nom: 'Inventaire' },
  { chemin: '/retours', nom: 'Retours' },
  { chemin: '/fournisseurs', nom: 'Fournisseurs' },
  { chemin: '/approvisionnement', nom: 'Approvisionnement' },
  { chemin: '/arrivage', nom: 'Arrivage' },
  { chemin: '/stock', nom: 'Stock' },
  { chemin: '/transferts', nom: 'Transferts' },
  { chemin: '/analytics', nom: 'Analytique' },
  { chemin: '/ia', nom: 'IA' },
  { chemin: '/messages', nom: 'Messages' },
  { chemin: '/mobile-money', nom: 'Mobile Money' },
  { chemin: '/peremption', nom: 'Peremption' },
  { chemin: '/boutiques', nom: 'Boutiques' },
  { chemin: '/parametres', nom: 'Parametres' },
];

test.describe.serial('Parcours des ecrans', () => {
  // Chaque test demarre avec la session deja ouverte : `beforeAll` produit
  // le fichier avant la creation du premier contexte.
  test.use({ storageState: ETAT_SESSION });

  test.beforeAll(async ({ browser }) => {
    await mkdir(dirname(ETAT_SESSION), { recursive: true });

    // Etat vide explicite : sans lui, le contexte heriterait du
    // `storageState` du fichier, qui n'existe pas encore — c'est lui qu'on
    // est en train de produire.
    const contexte = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await contexte.newPage();

    await page.goto('/login');
    await page.getByTestId('login-email').fill(COMPTE.email);
    await page.getByTestId('login-password').fill(COMPTE.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/(dashboard|selection-boutique)/, { timeout: 30000 });

    // Le jeton vit dans le stockage local : il faut le conserver pour le
    // reutiliser ecran par ecran. Sans cela, chaque test repartirait d'une
    // session vierge et afficherait l'ecran de connexion — un « parcours » qui
    // ne parcours rien.
    await contexte.storageState({ path: ETAT_SESSION });
    await contexte.close();
  });

  for (const ecran of ECRANS) {
    test(`${ecran.nom} se charge sans erreur console ni requete en echec`, async ({ page }) => {
      const erreursConsole: string[] = [];
      const requetesEnEchec: string[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') {
          erreursConsole.push(message.text());
        }
      });

      page.on('response', (response) => {
        if (response.status() >= 400) {
          requetesEnEchec.push(
            `${response.status()} ${response.request().method()} ${response.url()}`
          );
        }
      });

      await page.goto(ecran.chemin);

      // La page doit rendre : un ecran blanc ou une erreur de rendu ne
      // laisse aucun contenu, et le test doit le voir.
      await expect(page.locator('body')).not.toBeEmpty();

      // Laisse les requetes de chargement se terminer. `networkidle` peut ne
      // jamais arriver (le tableau de bord interroge periodiquement les
      // notifications) : le delai est donc borne, et l'attente se fait sur
      // le calme du reseau quand il vient.
      await page
        .waitForLoadState('networkidle', { timeout: 8000 })
        .catch(() => undefined);
      await page.waitForTimeout(1200);

      expect(requetesEnEchec, `Requetes en echec sur ${ecran.chemin}`).toEqual([]);
      expect(erreursConsole, `Erreurs console sur ${ecran.chemin}`).toEqual([]);
    });
  }
});
