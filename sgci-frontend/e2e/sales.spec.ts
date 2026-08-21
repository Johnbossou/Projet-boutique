import { test, expect } from '@playwright/test';

test.describe('Sales / Cash Register', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'caissier@sgci.bj');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to sales
    await page.click('text=Caisse');
    await page.waitForURL('/caisse');
  });

  test('should display cash register interface', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Caisse');
    await expect(page.locator('text=Nouvelle vente')).toBeVisible();
  });

  test('should add product to cart', async ({ page }) => {
    // Select a product
    await page.click('button:has-text("Ajouter")');
    
    // Verify cart is updated
    await expect(page.locator('text=Panier')).toBeVisible();
  });

  test('should show payment options', async ({ page }) => {
    await page.click('text=Payer');
    
    await expect(page.locator('text=Mode de paiement')).toBeVisible();
    await expect(page.locator('text=Espèces')).toBeVisible();
    await expect(page.locator('text=Mobile Money')).toBeVisible();
  });

  test('should complete sale', async ({ page }) => {
    // Add product to cart
    await page.click('button:has-text("Ajouter")');
    
    // Go to payment
    await page.click('text=Payer');
    
    // Select payment method
    await page.click('text=Espèces');
    
    // Enter amount
    await page.fill('input[name="montant_recu"]', '10000');
    
    // Complete sale
    await page.click('button:has-text("Terminer")');
    
    // Should show success message
    await expect(page.locator('text=Vente enregistrée')).toBeVisible();
  });
});
