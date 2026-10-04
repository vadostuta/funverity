# funverity — Nx + agentic e2e demo

> **📊 Talk slides — NN Wrocław meetup:**
> **https://docs.google.com/presentation/d/e/2PACX-1vQkThTUfZ8-aKtJtj_Q9MxNv49f6MD5OqUv8TMLZF3so_t2Ri7BnN6C8p3tsSAqLA/pub?start=false&loop=false&delayms=3000**
>
> This repo is the **live demo** for that talk. Start with the slides, then run the demo below.

The app (a Supply Chain Finance invoice-financing feature, Nx 23 + Angular 21) is only the
stage. The actual subject is the `tools/workspace-plugin` generators: turning a plain-english
user story into a **verified** Playwright e2e test, with Nx supplying the deterministic
scaffolding around a non-deterministic actor (an LLM).

**The thesis:** every generator is a typed, schema-validated command — discoverable via
`nx list`, invoked with validated args, backed by an atomic virtual filesystem (`Tree`) and
workspace-aware helpers like `getProjects()`. The agent never has to hallucinate paths, invent
flags, or half-write files, because the sanctioned actions are defined by the workspace itself.
The LLM writes the spec; **Nx** decides where it lands, what context feeds it, and which quality
gates it must pass. That's what turns agentic runs from snowflake demos into reproducible,
CI-composable workflows.

---

## 1. Quick setup

**Prerequisites:** Node 20+, npm. For the agent demo also the [Claude Code](https://claude.com/claude-code) CLI on your `PATH`.

```bash
npm install --legacy-peer-deps   # apollo-angular pins graphql ^16, a transient dep pulls ^17
npx playwright install chromium  # first time only — needed by the demo's verify step
```

### Run the app

```bash
npx nx run shop:serve:development
# → http://localhost:4200 (redirects to /invoices)
```

Leave this running — the agent demo drives this live app through the Playwright MCP server.
Use the role switcher on the Settings page to flip between supplier / buyer permissions.

### Sanity checks (optional)

```bash
npx vitest run                                                  # unit tests, all libs
npx playwright test --config apps/shop-e2e/playwright.config.ts # existing e2e
npx nx graph                                                    # project graph
```

---

## 2. Agent demo run

Three generators in `tools/workspace-plugin`, listed by Nx like any other:

```bash
npx nx list @funverity/workspace-plugin
```

| Generator | What it does |
|---|---|
| `generate-e2e`  | Composes a context-engineered prompt from a user story (feature-lib context, reference spec, mocked Zephyr test case) → `.github/prompts/generated/<slug>.prompt.md` |
| `verify-e2e`    | Static gates (ESLint + `tsc` + structural checks) + a real Playwright run on a spec file. `--heal` spawns Claude with the captured errors to fix it in place |
| `oneshot-e2e`   | All of it unattended: compose → invoke Claude headlessly → verify → retry with error context |

> The workspace sets `defaultCollection: @funverity/workspace-plugin`, so the short
> `nx g generate-e2e` form works — no package prefix needed.

### The staged run (what happens on stage)

**Step 1 — compose the prompt.** Nx resolves the feature lib, reads the reference spec, and
writes a prompt file. No LLM involved yet.

```bash
npx nx g generate-e2e --story "supplier filters invoices by APPROVED status"
```

**Step 2 — hand the prompt to an agent.** In a second Claude Code window:

```
Read .github/prompts/generated/supplier-filters-invoices-by.prompt.md and follow it
```

The agent explores the running app via the Playwright MCP server (`.mcp.json`) and grounds
every selector in the real accessibility tree before writing
`apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts`.

**Step 3 — verify.** The quality gate the workspace owns, not the agent:

```bash
npx nx g verify-e2e --file apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts
```

**Step 4 — break it.** Edit the spec and change one selector name (e.g. `'Filter'` → `'Filtre'`),
then watch it fail:

```bash
cd apps/shop-e2e && npx playwright test src/supplier-filters-invoices-by.spec.ts --ui
```

**Step 5 — self-heal.** Same gate, now allowed to call an agent with the captured failure:

```bash
npx nx g verify-e2e \
  --file apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts \
  --heal

cd apps/shop-e2e && npx playwright test src/supplier-filters-invoices-by.spec.ts --ui
```

**Step 6 — reset the stage.**

```bash
rm -f apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts \
      .github/prompts/generated/supplier-filters-invoices-by.prompt.md
```

**Step 7 — the one-shot.** Everything above, one command, no human in the loop:

```bash
npx nx g oneshot-e2e --story "supplier filters invoices by APPROVED status"
```

It compiles the prompt, spawns `claude -p` (default `--model sonnet`, 10 min timeout,
`--dangerously-skip-permissions` so it won't block on approvals), verifies the result, and on
failure re-invokes Claude with the error output — up to `--maxRetries 2` (3 attempts total).
Finishes with a PASS/FAIL summary and the time split between Claude and Playwright.

Useful flags: `--model opus|sonnet|haiku`, `--maxRetries 0` (fail fast),
`--timeoutMinutes`, `--skipPermissions false`, `--featureLib`, `--referenceSpec`.

---

## 3. The app under test

Enough structure for the generators to have real context to engineer.

```
apps/
  shop/           Angular 21 app          scope:shop
  shop-e2e/       Playwright specs        (generated specs land here)
libs/
  invoicing/
    domain/       scope:invoicing  type:util
    data-access/  scope:invoicing  type:data-access
    ui/           scope:invoicing  type:ui
    feature-list/ scope:invoicing  type:feature
  auth/
    data-access/  scope:auth       type:data-access
tools/
  workspace-plugin/   the demo generators
```

Import paths, all through public `index.ts` barrels: `@org/invoicing/domain`,
`@org/invoicing/data-access`, `@org/invoicing/ui`, `@org/invoicing/feature-list`,
`@org/auth/data-access`.

### Boundary rules (`eslint.config.mjs`)

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

Enforce them:

```bash
npx nx run-many --target=lint --projects=invoicing-domain,invoicing-data-access,invoicing-ui,invoicing-feature-list,auth-data-access
```

**Concrete bug the `ui → no services` rule prevents:** a UI developer adds a direct
`inject(InvoicingStore)` inside `InvoiceStatusBadgeComponent` to show a loading spinner. The
component passes unit tests (the store is easily provided in isolation), but in production the
badge renders in a context where the store isn't provided and throws `NullInjectorError`. The
boundary rule fails `nx lint` before the file reaches review.

### State ownership

**`AuthStore`** is a global NgRx SignalStore (`providedIn: 'root'`). Current user and
permissions are cross-cutting — every feature with a permission-gated action needs them, and
they change only on login/logout. A single shared instance avoids stale permission snapshots
across feature stores. In a micro-frontend shell this moves to a shared library loaded by the
shell; the same `providedIn: 'root'` pattern still works via a shared vendor bundle.

**`InvoicingStore`** is `providedIn: 'root'` in this sandbox. In production I'd scope it to the
invoicing feature route (`providers: [InvoicingStore]` on the lazy route) — the invoice list
isn't needed globally, scoping prevents stale state on navigation and makes reset-on-destroy
free. Teams get this wrong by defaulting everything to root and accumulating state that
reappears when users navigate back. Left at root here to keep the demo trivially reproducible;
it's a one-line change.

**Filters and search** are owned by `InvoicingStore` as `filteredInvoices` derived state —
never filtered in the template — so the result is reactive, cacheable, and testable without a
DOM. `InvoicingListContainer.rows` composes it with `requestableInvoices` and
`canViewFinancingOffer` (both computed on the store) into a single `InvoiceRowUi[]`.

### Security notes

A starting CSP ships as a `<meta>` in `apps/shop/src/index.html`, intentionally conservative
(`default-src 'self'`, `object-src 'none'`) with two compromises documented inline:
`'unsafe-inline'` on `style-src` (Angular injects component styles at runtime and there's no
backend to mint per-request nonces yet), and no `frame-ancestors` / `report-to` (both ignored
inside `<meta>`). Both close up once the SPA sits behind a proxy that can set response headers
and template a nonce.

Client permission checks (`AuthStore`, `RequestableInvoiceUi`, `canViewFinancingOffer`) are UX
only — they hide UI so honest users aren't confused. Real authorization belongs server-side on
every request. The role switcher on the Settings page is a demo affordance and would be removed
(or gated behind a build flag) in production.
