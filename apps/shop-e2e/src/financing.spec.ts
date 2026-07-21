import { expect, test } from '@playwright/test';

const REQUEST_FINANCING = /Request Financing/i;

test.describe('Request Financing — permission gating', () => {
  test('supplier with permission flips the clicked invoice from APPROVED to FINANCING_REQUESTED', async ({
    page,
  }) => {
    await page.goto('/settings');

    await page.getByRole('button', { name: /Supplier \(Financing\)/i }).click();
    await expect(page.locator('.active-role')).toHaveText(/Demo Supplier/);

    await page.getByRole('link', { name: /Invoices/i }).click();
    await expect(page).toHaveURL(/\/invoices$/);

    const requestableItem = page
      .locator('.invoice-list__item')
      .filter({ has: page.getByRole('button', { name: REQUEST_FINANCING }) })
      .first();

    const invoiceNumber = (
      await requestableItem.locator('.invoice-list__number').innerText()
    ).trim();
    await expect(requestableItem.locator('.badge')).toHaveAttribute(
      'data-status',
      'APPROVED',
    );

    await requestableItem
      .getByRole('button', { name: REQUEST_FINANCING })
      .click();

    const clickedInvoice = page.locator('.invoice-list__item', {
      hasText: invoiceNumber,
    });
    await expect(clickedInvoice).toHaveCount(1);
    await expect(clickedInvoice.locator('.badge')).toHaveAttribute(
      'data-status',
      'FINANCING_REQUESTED',
    );
    await expect(
      clickedInvoice.getByRole('button', { name: REQUEST_FINANCING }),
    ).toHaveCount(0);
  });

  test('default user without financing permission does not see the Request Financing button', async ({
    page,
  }) => {
    await page.goto('/invoices');

    await expect(page.locator('.active-role')).toHaveText(/Default User/);
    await expect(page.getByText('No invoices found.')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: REQUEST_FINANCING }),
    ).toHaveCount(0);
  });
});
