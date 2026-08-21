import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Login/);
    await expect(page.locator('h1')).toContainText('Connexion');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Email est requis')).toBeVisible();
    await expect(page.locator('text=Mot de passe est requis')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'gerant@sgci.bj');
    await page.fill('input[name="password"]', 'password');
    
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@email.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Identifiants invalides')).toBeVisible();
  });
});
