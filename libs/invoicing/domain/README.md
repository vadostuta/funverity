# `@org/invoicing/domain`

Pure TypeScript types for the invoicing feature. No runtime code, no Angular
imports — safe to consume from any layer.

## What lives here

- `InvoiceStatus` — string enum: `DRAFT`, `APPROVED`, `FINANCING_REQUESTED`,
  `FINANCED`, `PAID`, `REJECTED`.
- `InvoiceUi` — the shape a UI component receives (id, invoiceNumber,
  supplierName, buyerName, amount in minor units, currency, dueDate, status,
  optional `financingOffer`).
- `RequestableInvoiceUi` — a **branded type** that is a subtype of
  `InvoiceUi`. The brand is the compile-time proof that (a) the invoice is
  APPROVED and (b) the caller obtained it via `InvoicingStore.requestableInvoices()`
  — i.e. the current user holds `supplier:financing`. Only values of this
  branded type can be passed to `requestFinancing()`. This makes it
  impossible to call `requestFinancing` on an ineligible invoice without a
  compile error.
- `InvoiceFilterUi` — `{ status: InvoiceStatus | null; search: string }`.
- `toRequestable(inv)` — the brand constructor. Returns
  `RequestableInvoiceUi | null`.

## What this feature does

Represents an invoice in the supplier's inbox and the *financing request*
lifecycle. An invoice starts as DRAFT, is APPROVED by a buyer, then the
supplier can request early financing on it (status → FINANCING_REQUESTED),
after which it moves to FINANCED and eventually PAID.

Only APPROVED invoices can be financed. Only suppliers with the
`supplier:financing` permission can request it. Both of those invariants
are enforced through the branded type, not through runtime `if` guards.
