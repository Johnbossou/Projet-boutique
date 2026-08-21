import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'gerant@sgci.bj');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display dashboard with stats', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Check for stat cards
    await expect(page.locator('text=Ventes aujourd\'hui')).toBeVisible();
    await expect(page.locator('text=Chiffre d\'affaires')).toBeVisible();
    await expect(page.locator('text=Produits en stock')).toBeVisible();
  });

  test('should navigate to products page', async ({ page }) => {
    await page.click('text=Produits');
    await expect(page).toHaveURL('/produits');
    await expect(page.locator('h1')).toContainText('Produits');
  });

  test('should navigate to sales page', async ({ page }) => {
    await page.click('text=Caisse');
    await expect(page).toHaveURL('/caisse');
    await expect(page.locator('h1')).toContainText('Caisse');
  });

  test('should navigate to analytics page', async ({ page }) => {
    await page.click('text=Analytics');
    await expect(page).toHaveURL('/analytics');
    await expect(page.locator('h1')).toContainText('Analytics');
  });
});
