# `@org/invoicing/data-access`

State and I/O for the invoicing feature. Consumers of this lib only see the
`InvoicingStore` — everything else is internal.

## `InvoicingStore` (ngRx signalStore, providedIn root)

### State

- `invoices: InvoiceUi[]` — the full loaded list.
- `filter: { status: InvoiceStatus | null; search: string }`.
- `loading: boolean` — true while the initial fetch is in flight.
- `requestStatus: 'idle' | 'pending' | 'success' | 'error'` — status of the
  in-flight `requestFinancing` call.
- `requestError: string | null`.

### Computed signals

- **`filteredInvoices`** — applies `filter.status` (equality) and
  `filter.search` (case-insensitive substring on `invoiceNumber` or
  `buyerName`). Returns `InvoiceUi[]`.
- **`requestableInvoices`** — permission-gated (`auth.hasFinancingPermission()`).
  Maps every APPROVED invoice through `toRequestable(inv)` and yields
  `RequestableInvoiceUi[]`. Empty for users without the permission.
- **`canViewFinancingOffer`** — same permission gate, exposed for the UI to
  decide whether to render offer details.

### Methods

- `loadInvoices()` — fires the GraphQL query, populates `invoices`.
- `setFilter(patch)` — merges into the filter partial-update style.
- `requestFinancing(invoice: RequestableInvoiceUi)` — optimistic update:
  flips the local status to FINANCING_REQUESTED, calls the mutation, either
  confirms (server-truth response) or rolls back to the original invoice on
  error.

## Transport

- Apollo Client with a **mock link** — an in-memory ApolloLink that
  intercepts the two operations (`getInvoices`, `requestFinancing`) and
  returns canned responses from a static fixture. No real HTTP.
- The mock is deterministic — the same query returns the same result each
  run. The `requestFinancing` mutation randomises errors for a small
  fraction of invoices to demonstrate rollback.
