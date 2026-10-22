import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke e2e.
 *
 * Le navigateur : chromium seul en CI (l'image de Firefox et de WebKit pese
 * plusieurs centaines de megabytes a telecharger pour rien : le smoke verifie
 * que l'application demarre et que la connexion passe, pas le moteur). En
 * local, les trois moteurs sont proposes — le choix se fait par
 * `--project=`.
 */
const projets = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  ...(process.env.CI
    ? []
    : [
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
      ]),
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Un seul worker : le serveur de developpement PHP est mono-thread, et les
  // pages e2e enchainent login, /me, boutique, statistiques... En parallele,
  // les requetes s'empilent et le chargement depasse le delai — un echec
  // d'infrastructure, pas de l'application. Le smoke est court : la
  // serialisation ne coute que quelques secondes.
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  timeout: 60000,
  expect: { timeout: 15000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: projets,

  webServer: {
    // En local, le serveur de developpement est utilise. En CI, le build de
    // production est fait en amont (etape dediee) et le serveur demarre ici.
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
    },
  },
});
