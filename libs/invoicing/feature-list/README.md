# `@org/invoicing/feature-list`

The single feature component for the invoices page: a smart container that
glues `InvoicingStore` to the presentational components in
`@org/invoicing/ui`.

## `InvoicingListContainer`

Route target for `/invoices`. `standalone`, OnPush.

Responsibilities:

1. On `ngOnInit`, calls `store.loadInvoices()`.
2. Renders a loading placeholder while `store.loading()` is `true`:
   `<p>Loading invoices…</p>`
3. Renders `<lib-invoice-filters>` bound to `store.filter().search` and
   `store.filter().status`, wiring `searchChange` / `statusChange` back into
   `store.setFilter(...)`.
4. Builds a `rows` computed from `store.filteredInvoices()`,
   `store.requestableInvoices()`, and `store.canViewFinancingOffer()`, then
   passes the resulting `InvoiceRowUi[]` to `<lib-invoice-list>`.
5. On the list's `(requestFinancing)` output, calls
   `store.requestFinancing(...)`.
6. Renders an error paragraph when `store.requestStatus() === 'error'`.

## DOM anchors added by this container

- `.invoicing-list` — the outer wrapper.
- `p.error` — the mutation-error message.
- `<p>Loading invoices…</p>` — the loading placeholder (an e2e can assert
  this disappears before counting items, though the preferred wait is
  `locator.first().waitFor({ state: 'visible' })` on `.invoice-list__item`).

## What e2e specs typically do here

- Navigate to `/invoices`.
- Wait for `.invoice-list__item` to appear.
- Interact with `.filters .search-input` or `.filters select`.
- Click `getByRole('button', { name: /Request Financing/i })` on a specific
  row and assert the badge flips to `data-status="FINANCING_REQUESTED"`.
