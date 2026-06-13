import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['iPhone 14'],
  viewport: { width: 390, height: 844 },
});

test.describe('Mobile Bottom Nav + Visual Regression', () => {
  test('Bottom nav visual consistency across roles', async ({ page }) => {
    // Login as different roles and snapshot bottom nav
    const roles = ['technician', 'chief_engineer', 'system_admin'];
    for (const role of roles) {
      await page.evaluate(r => localStorage.setItem('ROLE_HINT', r), role);
      await page.goto('/');
      await expect(page.locator('nav.fixed.bottom-0')).toBeVisible();

      await expect(page.locator('nav.fixed.bottom-0')).toHaveScreenshot(`bottom-nav-${role}.png`, {
        threshold: 0.02, // 2% pixel difference tolerance
      });
    }
  });

  test('Full mobile page visual regression after nav click', async ({ page }) => {
    await page.goto('/');
    const navItem = page.locator('nav.fixed.bottom-0 button').first();
    await navItem.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('mobile-after-nav-click.png', { fullPage: true, threshold: 0.03 });
  });
});
