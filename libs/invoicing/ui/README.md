# `@org/invoicing/ui`

Presentational components for the invoicing feature. No injection, no
Angular services, no `HttpClient` — everything comes in via `input()` and
goes out via `output()`. All components are standalone with
`ChangeDetectionStrategy.OnPush`.

## Components

### `<lib-invoice-filters>`

Search input + status dropdown. Emits `searchChange` and `statusChange`.

- DOM anchors that e2e should rely on:
  - `.filters` — root wrapper
  - `.filters .search-input` — the text input
  - `.filters select` — the status dropdown; option values are the raw
    `InvoiceStatus` values (`APPROVED`, `FINANCING_REQUESTED`, …) plus an
    empty-string option (`All statuses`).

### `<lib-invoice-list>`

Renders a list of `InvoiceRowUi` rows. Emits `requestFinancing` when the
button is clicked.

- DOM anchors:
  - `.invoice-list` — the `<ul>`
  - `.invoice-list__item` — each `<li>` row
  - `.invoice-list__number` — the invoice number span
  - `.invoice-list__amount` — the formatted amount + currency
  - `button` inside a row with text `Request Financing` — only rendered
    for rows whose `row.requestable` is truthy (i.e. APPROVED + permission)
  - `.invoice-list__offer` — the discount/net/expires panel, only rendered
    when `row.offer` is set (permission-gated)
  - `.invoice-list__empty` — "No invoices found." shown when the list is
    empty (`@empty` branch)

### `<lib-invoice-status-badge>`

Small pill showing the current status.

- DOM: `.badge[data-status="<STATUS>"]` — the status value goes into a
  `data-status` attribute for CSS theming *and* for e2e assertions. The
  visible label is the status with underscores replaced by spaces.

## Style contract for e2e

Prefer role-based selectors first (`getByRole('button', { name: /.../ })`,
`getByText(...)`) — fall back to the CSS anchors above only when role
selectors don't disambiguate. Never rely on nth-child or absolute positions.
