# `@org/auth/data-access`

Auth state for the app — role and permission signals. Deliberately tiny;
the demo app has two hardcoded roles and no real login flow.

## `AuthStore` (ngRx signalStore, providedIn root)

### State

- `activeRole: AppRole` — one of `'default' | 'supplier-financing'`.
  Starts at `'default'`. Persisted to `localStorage` under a well-known
  key so refreshes preserve the demo state.

### Computed signals

- `hasFinancingPermission()` — `true` iff `activeRole === 'supplier-financing'`.
  This is the sole gate used by the invoicing store to expose
  `requestableInvoices` and the financing offer panel.

### Methods

- `setRole(role: AppRole)` — patches state and writes-through to
  localStorage.

## Roles as shown in the Settings page

- **Default User** (`default`) — permissions: `supplier:view`. Can see
  invoices but cannot request financing. The "Request Financing" button is
  not rendered on any row.
- **Supplier (Financing)** (`supplier-financing`) — permissions:
  `supplier:view`, `supplier:financing`. Sees financing offers and can
  click "Request Financing" on any APPROVED invoice.

## How e2e specs interact with roles

The reference spec (`apps/shop-e2e/src/financing.spec.ts`) switches roles
by navigating to `/settings` and clicking the role card button:

```typescript
await page.goto('/settings');
await page.getByRole('button', { name: /Supplier \(Financing\)/i }).click();
await expect(page.locator('.active-role')).toHaveText(/Demo Supplier/);
```

There is no login step and no session — the state lives entirely in the
signal store + localStorage.
