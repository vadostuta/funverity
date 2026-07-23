import { expect, test } from '@playwright/test';

test.describe('Supplier filters invoices by APPROVED status', () => {
  test('narrows the list so every visible invoice has data-status="APPROVED"', async ({
    page,
  }) => {
    await page.goto('/settings');

    await page.getByRole('button', { name: /Supplier \(Financing\)/i }).click();
    await expect(page.locator('.active-role')).toHaveText(/Demo Supplier/);

    await page.getByRole('link', { name: /Invoices/i }).click();
    await expect(page).toHaveURL(/\/invoices$/);

    const items = page.locator('.invoice-list__item');
    await items.first().waitFor({ state: 'visible' });
    const totalCount = await items.count();
    expect(totalCount).toBeGreaterThan(0);

    await page.locator('.filters select').selectOption('APPROVED');

    await expect
      .poll(async () => await items.count(), { timeout: 5000 })
      .toBeLessThan(totalCount);

    const filteredCount = await items.count();
    expect(filteredCount).toBeGreaterThan(0);

    const badges = page.locator('.invoice-list__item .badge');
    await expect(badges).toHaveCount(filteredCount);
    const statuses = await badges.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('data-status')),
    );
    expect(statuses.every((s) => s === 'APPROVED')).toBe(true);
  });

  test('resetting to "All statuses" restores the full unfiltered list', async ({
    page,
  }) => {
    await page.goto('/settings');

    await page.getByRole('button', { name: /Supplier \(Financing\)/i }).click();
    await expect(page.locator('.active-role')).toHaveText(/Demo Supplier/);

    await page.getByRole('link', { name: /Invoices/i }).click();
    await expect(page).toHaveURL(/\/invoices$/);

    const items = page.locator('.invoice-list__item');
    await items.first().waitFor({ state: 'visible' });
    const unfilteredCount = await items.count();

    await page.locator('.filters select').selectOption('APPROVED');
    await expect
      .poll(async () => await items.count(), { timeout: 5000 })
      .toBeLessThan(unfilteredCount);

    await page.locator('.filters select').selectOption('');
    await expect
      .poll(async () => await items.count(), { timeout: 5000 })
      .toBe(unfilteredCount);
  });
});
