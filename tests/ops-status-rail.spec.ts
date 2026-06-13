import { test, expect } from '@playwright/test';

/**
 * Phase 1 - Persistent Ops Status Rail E2E tests
 * Covers visibility in vessel-local mode and basic interactions
 */

test.describe('OpsStatusRail (Persistent)', () => {
  test.beforeEach(async ({ page }) => {
    // Assume a way to force vessel-local mode for testing
    await page.goto('/operations');
    // In real tests you would set local storage / mock API for vessel-local
  });

  test('rail is visible on Operations hub', async ({ page }) => {
    const rail = page.getByRole('region', { name: /persistent operational status rail/i });
    await expect(rail).toBeVisible();
  });

  test('shows critical risk pill with actions when present', async ({ page }) => {
    // This test would require seeding a high-severity risk via API or mock
    const riskPill = page.getByText(/bearing overheat|ai risk/i).first();
    await expect(riskPill).toBeVisible();

    const acceptBtn = page.getByRole('button', { name: /accept wo/i });
    await expect(acceptBtn).toBeVisible();
  });

  test('outbox and handover pills are visible', async ({ page }) => {
    await expect(page.getByText(/outbox/i)).toBeVisible();
    await expect(page.getByText(/handover in/i)).toBeVisible();
  });

  test('vessel-local status is shown', async ({ page }) => {
    await expect(page.getByText(/vessel-local/i)).toBeVisible();
  });

  test('clicking Review outbox triggers action', async ({ page }) => {
    const reviewBtn = page.getByRole('button', { name: /review/i }).first();
    await reviewBtn.click();
    // Expect navigation or drawer to open - adjust selector as needed
    await expect(page.getByText(/outbox queue|offline items/i)).toBeVisible();
  });
});
