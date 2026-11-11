/**
 * Tour de l'application dans un navigateur visible.
 *
 * Ce script n'est pas un test : il ouvre une fenetre Chromium sur l'ecran,
 * se connecte, puis visite les ecrans un par un en prenant une capture a
 * chaque etape. Il collecte au passage les erreurs de la console et les
 * requetes en echec — c'est ce qui se passe « autour » de l'affichage.
 *
 * Usage : node scripts/tour.mjs [dossier-captures]
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
const DOSSIER = process.argv[2] || 'storage/tour';

const ECRANS = [
  ['dashboard', 'Tableau de bord'],
  ['clients', 'Clients'],
  ['produits', 'Produits'],
  ['commandes-clients', 'Commandes clients'],
  ['commandes-fournisseurs', 'Commandes fournisseurs'],
  ['fidelite', 'Fidelite'],
  ['caisse', 'Caisse'],
  ['devis', 'Devis'],
  ['factures', 'Factures'],
  ['inventaire', 'Inventaire'],
  ['retours', 'Retours'],
  ['fournisseurs', 'Fournisseurs'],
  ['approvisionnement', 'Approvisionnement'],
  ['arrivage', 'Arrivage'],
  ['stock', 'Stock'],
  ['transferts', 'Transferts'],
  ['analytics', 'Analytique'],
  ['ia', 'IA'],
  ['messages', 'Messages'],
  ['mobile-money', 'Mobile Money'],
  ['peremption', 'Peremption'],
  ['boutiques', 'Boutiques'],
  ['parametres', 'Parametres'],
];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(DOSSIER, { recursive: true });

const navigateur = await chromium.launch({ headless: false, slowMo: 120 });
const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
const page = await contexte.newPage();

let erreursConsole = [];
let requetesEnEchec = [];

page.on('console', (m) => {
  if (m.type() === 'error') erreursConsole.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) {
    requetesEnEchec.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, 'API')}`);
  }
});

console.log(`→ ouverture de ${BASE}`);
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

console.log('→ connexion proprietaire@sgci.bj');
await page.getByTestId('login-email').fill('proprietaire@sgci.bj');
await page.getByTestId('login-password').fill('password');
await page.getByTestId('login-submit').click();
await page.waitForURL(/\/(dashboard|selection-boutique)/, { timeout: 30000 });
await attendre(1500);

for (const [chemin, nom] of ECRANS) {
  erreursConsole = [];
  requetesEnEchec = [];

  await page.goto(`${BASE}/${chemin}`, { waitUntil: 'domcontentloaded' });

  // On attend que le reseau se calme : une capture prise pendant le
  // chargement montre des compteurs a zero et un rouet — l'ecran a l'air
  // vide alors qu'il est simplement en train de se remplir.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  await attendre(1500);

  const fichier = `${DOSSIER}/${String(ECRANS.findIndex((e) => e[0] === chemin) + 1).padStart(2, '0')}-${chemin}.png`;
  // `animations: 'disabled'` : une capture attend sinon que la page se
  // stabilise, et les animations d'entree (framer-motion) qui tournent en
  // boucle font expirer le delai de 30 s — le tour s'arretait sur l'ecran
  // fidelite.
  await page.screenshot({ path: fichier, animations: 'disabled', timeout: 60000 });

  const titre = await page.title().catch(() => '');
  const marqueur = erreursConsole.length + requetesEnEchec.length;

  console.log(`\n■ ${nom} (/${chemin}) — ${titre}`);
  console.log(`  capture : ${fichier}`);
  if (marqueur === 0) {
    console.log('  aucune erreur console, aucune requete en echec');
  } else {
    for (const e of [...new Set(erreursConsole)]) console.log(`  ✗ console : ${e.slice(0, 220)}`);
    for (const r of [...new Set(requetesEnEchec)]) console.log(`  ✗ requete : ${r}`);
  }
}

await attendre(2000);
await navigateur.close();
console.log('\n→ tour terminé');
