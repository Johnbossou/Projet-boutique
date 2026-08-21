import { test, expect } from '@playwright/test';

test.describe('Products Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'gerant@sgci.bj');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to products
    await page.click('text=Produits');
    await page.waitForURL('/produits');
  });

  test('should display products list', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Produits');
    await expect(page.locator('table')).toBeVisible();
  });

  test('should search products', async ({ page }) => {
    await page.fill('input[placeholder*="Rechercher"]', 'test');
    
    // Wait for search to complete
    await page.waitForTimeout(500);
    
    // Verify search input has value
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await expect(searchInput).toHaveValue('test');
  });

  test('should open create product modal', async ({ page }) => {
    await page.click('button:has-text("Ajouter")');
    
    await expect(page.locator('text=Nouveau produit')).toBeVisible();
    await expect(page.locator('input[name="nom"]')).toBeVisible();
  });

  test('should show product details', async ({ page }) => {
    // Click on first product in table
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    
    // Should show product details
    await expect(page.locator('text=Détails du produit')).toBeVisible();
  });
});
