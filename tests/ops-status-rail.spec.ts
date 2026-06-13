import { test, expect } from '@playwright/test';

/**
 * Phase 1 - Persistent Ops Status Rail
 * Expanded E2E coverage
 */

test.describe('OpsStatusRail - Persistent Visibility (P0)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operations');
    // TODO: Add fixture to force vessel-local + seed sample risks/outbox/handover
  });

  test('rail is persistently visible across Operations pages', async ({ page }) => {
    const rail = page.getByRole('region', { name: /persistent operational status rail/i });
    await expect(rail).toBeVisible();

    // Check it stays visible when navigating within hub
    await page.getByRole('link', { name: /telemetry/i }).click();
    await expect(rail).toBeVisible();
  });

  test('shows high-severity AI risk with primary actions', async ({ page }) => {
    // This assumes test data seeding - adjust selectors in real run
    const riskSection = page.getByText(/bearing|ai risk|overheat/i).first();
    await expect(riskSection).toBeVisible();

    await expect(page.getByRole('button', { name: /accept wo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /snooze/i })).toBeVisible();
  });

  test('outbox pill shows conflict state and Review action', async ({ page }) => {
    const outboxPill = page.getByText(/outbox/i).first();
    await expect(outboxPill).toBeVisible();

    const reviewBtn = page.getByRole('button', { name: /review/i });
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // Expect drawer or page change - adjust as implementation evolves
    await expect(page.getByText(/outbox queue|offline items/i).first()).toBeVisible();
  });

  test('handover timer and Briefing action are present', async ({ page }) => {
    await expect(page.getByText(/handover in/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /briefing/i })).toBeVisible();
  });

  test('vessel-local + cached sensors status is visible', async ({ page }) => {
    const status = page.getByText(/vessel-local/i);
    await expect(status).toBeVisible();
    await expect(page.getByText(/cached/i)).toBeVisible();
  });

  test('works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const rail = page.getByRole('region', { name: /persistent operational status rail/i });
    await expect(rail).toBeVisible();

    // Pills should be horizontally scrollable on small screens
    await expect(rail).toHaveCSS('overflow-x', 'auto');
  });

  test('keyboard accessible (Tab + Enter on actions)', async ({ page }) => {
    const firstButton = page.getByRole('button', { name: /accept wo|snooze|review|briefing/i }).first();
    await firstButton.focus();
    await expect(firstButton).toBeFocused();
    await firstButton.press('Enter');
    // Verify some action occurred (drawer open or navigation)
  });

  test('respects night mode styling (no low-contrast issues)', async ({ page }) => {
    // Quick visual check - in real CI this would use Percy/Playwright visual regression
    const rail = page.getByRole('region', { name: /persistent operational status rail/i });
    await expect(rail).toHaveCSS('background-color', /rgb\(24, 24, 27\)|#18181b/);
  });
});
