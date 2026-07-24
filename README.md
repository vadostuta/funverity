# Supply Chain Finance — Angular Take-Home

Nx 23 Angular 21 monorepo for the SCF invoice-financing feature.

And demo prep for Nn Wroclaw meetup
slides: https://docs.google.com/presentation/d/e/2PACX-1vQkThTUfZ8-aKtJtj_Q9MxNv49f6MD5OqUv8TMLZF3so_t2Ri7BnN6C8p3tsSAqLA/pub?start=false&loop=false&delayms=3000

---

## Quick Start

```bash
npm install --legacy-peer-deps   # apollo-angular pins graphql ^16, transient dep pulls ^17
npx nx run shop:serve:development
# → http://localhost:4200 (redirects to /invoices)
```

### Run unit tests

```bash
npx vitest run
```

Runs every lib's Vitest project (auth-data-access, invoicing-data-access, invoicing-feature-list, etc.) via the workspace config at `vitest.config.ts`.

### Run e2e tests (Playwright)

```bash
npx playwright install chromium   # first time only
npx playwright test --config apps/shop-e2e/playwright.config.ts
```

The Playwright config boots `nx run shop:serve` as its webServer, so no manual dev-server start.

### Lint (includes boundary enforcement)

```bash
npx nx run-many --target=lint --projects=invoicing-domain,invoicing-data-access,invoicing-ui,invoicing-feature-list,auth-data-access
```

### Project graph

```bash
npx nx graph
```

---

## Library Structure

```
libs/
  invoicing/
    domain/         scope:invoicing  type:util
    data-access/    scope:invoicing  type:data-access
    ui/             scope:invoicing  type:ui
    feature-list/   scope:invoicing  type:feature
  auth/
    data-access/    scope:auth       type:data-access
```

Import paths (all through public `index.ts` barrels):
- `@org/invoicing/domain`
- `@org/invoicing/data-access`
- `@org/invoicing/ui`
- `@org/invoicing/feature-list`
- `@org/auth/data-access`

---

## Boundary Rules (`eslint.config.mjs`)

| Source tag          | May depend on                                                   |
|---------------------|-----------------------------------------------------------------|
| `type:util`         | `type:util` only                                                |
| `type:data-access`  | `type:util`, `type:data-access`                                 |
| `type:ui`           | `type:util` — **no services, no store**                         |
| `type:feature`      | `type:util`, `type:data-access`, `type:ui`                      |
| `scope:invoicing`   | `scope:invoicing`, `scope:auth`                                 |
| `scope:auth`        | `scope:auth` only                                               |
| `scope:shop` (app)  | `scope:shop`, `scope:shared`, `scope:invoicing`, `scope:auth`   |
| `scope:shared`      | `scope:shared` only                                             |

**Concrete bug the `ui → no services` rule prevents:** A UI developer adds a direct `inject(InvoicingStore)` call inside `InvoiceStatusBadgeComponent` to show a loading spinner. The component passes unit tests (the store is easily provided in isolation), but in production the badge appears in a context where the store isn't provided and throws a `NullInjectorError`. The boundary rule makes this file fail `nx lint` before it reaches review.

---

## State Ownership Decision

**Auth store (`AuthStore`)** lives in a global NgRx SignalStore (`providedIn: 'root'`). Current user and permissions are cross-cutting: every feature that has an action gated on a permission needs them, and they change only on login/logout. A single shared instance avoids stale permission snapshots in different feature stores. If the app ever grows to a micro-frontend shell, this moves to a shared library loaded by the shell — the same `providedIn: 'root'` pattern still works via a shared vendor bundle.

**Invoicing store (`InvoicingStore`)** is `providedIn: 'root'` in this sandbox. In a production build I'd scope it to the invoicing feature route instead (`providers: [InvoicingStore]` on the lazy route) — the invoice list is not needed globally, scoping prevents stale state on navigation and makes reset-on-destroy free. Teams get this wrong by defaulting everything to root and accumulating state that reappears when users navigate back. Left as `providedIn: 'root'` here to keep the demo trivially reproducible; it's a one-line change when the app grows.

**Filters and search** are owned by `InvoicingStore` as `filteredInvoices` derived state — never filtered in the template — so the filtered result is reactive, cacheable, and testable without a DOM. `InvoicingListContainer.rows` composes this with `requestableInvoices` and `canViewFinancingOffer` (both computed on the store) into a single `InvoiceRowUi[]` for the list component.

---

## Security notes

A starting CSP is delivered as a `<meta>` in `apps/shop/src/index.html`. It's intentionally conservative (`default-src 'self'`, `object-src 'none'`, etc.) with two known compromises documented inline: `'unsafe-inline'` on `style-src` (Angular injects component styles at runtime and there's no backend to mint per-request nonces yet), and no `frame-ancestors` / `report-to` (both are ignored inside `<meta>`). Both close up once the SPA is served behind a proxy that can set response headers and template a nonce.

Client permission checks (`AuthStore`, `RequestableInvoiceUi`, `canViewFinancingOffer`) are UX only — they hide UI so honest users aren't confused. Actual authorization must live server-side on every request. The role-switcher on the Settings page is a demo affordance and would be removed (or gated behind a build flag) in production.
