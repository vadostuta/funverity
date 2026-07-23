# E2E Test Generation — Context-Engineered Prompt

You are a Senior QA Automation Engineer generating a production-ready
Playwright e2e test for the funverity shop app. Follow the exact project
patterns shown below.
---

## User Story
supplier filters invoices by APPROVED status
---

## Test Case (MOCK-SUPPLIER-FIL) — mocked from story
**Name:** supplier filters invoices by APPROVED status
**Objective:** Verify the behaviour described by: "supplier filters invoices by APPROVED status"
**Precondition:** App is running at http://localhost:4200. Default role is active.
**Priority:** Normal
**Labels:** mocked, e2e, demo

### Steps
1. **Action:** Navigate to the relevant page in the app
   **Data:** —
   **Expected:** Page renders with visible content matching the story
2. **Action:** Perform the user action described in the story
   **Data:** —
   **Expected:** The UI responds as the story predicts
3. **Action:** Assert the observable end state
   **Data:** —
   **Expected:** End state is verifiable via role/text/CSS selectors
---

## Feature Documentation (libs/invoicing/feature-list/README.md)
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

---

## Reference Spec (59 lines, 2 existing tests)

### Imports (mirror these)
```typescript
import { expect, test } from '@playwright/test';
```

### Existing describe blocks (follow this pattern)
```typescript
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
```
---

## House Style Guidelines (from .github/prompts/ae-playwright.md)
# Finverity — Playwright E2E house style

You are an expert Playwright + TypeScript E2E engineer working in the
finverity Nx monorepo. Your job: given a plain-language user story and the
project context supplied above, produce a single spec file that a reader can
run *immediately* and that would visibly fail if the feature under test
regressed.

## Project layout

- Nx workspace, Angular app under `apps/shop`, Playwright e2e project under
  `apps/shop-e2e`.
- Specs live flat under `apps/shop-e2e/src/<slug>.spec.ts`. No cycles, no
  fixtures, no support/ directory. Do not invent one.
- The Playwright config auto-serves the app via `nx run shop:serve`, so
  navigating to `/` or `/invoices` from a spec Just Works — no setup.

## Import rules

- Import both `test` and `expect` from `@playwright/test`. Only from there.
- Do not import from any `support/` path, from `apps/shop`, or from `libs/*`.
  The e2e project is intentionally decoupled from the app source.

## Selector rules

Prefer, in order:

1. `page.getByRole('button', { name: /Request Financing/i })` — role +
   accessible-name regex.
2. `page.getByText(...)` — for prose the DOM actually renders.
3. CSS class anchored on markup seen in the app source, e.g.:
   - `.invoice-list__item`
   - `.badge[data-status="APPROVED"]`
   - `.filters select`

Never invent selectors. If the story requires an element that is not visible
in the reference spec or in the feature docs above, say so explicitly in a
comment instead of guessing.

## Waits — non-negotiable

The invoices list renders after an async load. If you count `.invoice-list__item`
before it renders, you'll count zero and the test will flake or pass
trivially.

Always wait explicitly:

```typescript
const items = page.locator('.invoice-list__item');
await items.first().waitFor({ state: 'visible' });
const count = await items.count();
```

For assertions that depend on state changing after an interaction, use
`expect.poll(...)` with a timeout, not a hardcoded sleep.

## Assertions must discriminate

The single most important rule.

- A test that passes even when the feature is broken is worse than no test.
- Every `test(...)` block must contain at least one assertion that would
  visibly fail if the feature under test regressed.
- If the story is about filtering: assert both that the filtered list is
  smaller than the unfiltered list AND that every remaining item matches the
  filter criterion. Either alone is insufficient.
- If the story is about a status change: capture the state before, perform
  the action, assert the state after — do not just assert the button exists.

## Style

- One `test.describe(...)` block per spec file, named after the feature.
- Inside, 1–2 focused `test(...)` blocks. Prefer two small tests over one
  long branching test.
- No try/catch, no arbitrary sleeps, no `page.waitForTimeout`.
- Descriptive test titles — someone reading the failure report should
  understand what regressed without opening the file.

## Verification loop — mandatory, do not skip

Before you are done, prove the spec actually works. Do this in three phases,
in order, without stopping at "the spec compiles."

### Phase 1 — Explore the app via Playwright MCP (before writing the spec)

The `playwright` MCP server is registered in this workspace. Use these
browser tools to *observe* real DOM before you commit to selectors:

- `browser_navigate` — open the app at a URL (e.g. `http://localhost:4200/invoices`).
- `browser_snapshot` — get an accessibility snapshot of the current page. Read
  it. This is your source of truth for role, name, and text attributes.
- `browser_click`, `browser_fill_form`, `browser_select_option`,
  `browser_press_key` — perform the interaction from the story once, so you
  see what actually changes.

Ground every selector in this snapshot. Do not translate the story into
selectors from imagination; translate it from the snapshot you just took.

### Phase 2 — Write the spec, then run it

Write `apps/shop-e2e/src/<slug>.spec.ts` following all rules above. Then:

```
cd apps/shop-e2e && npx playwright test src/<slug>.spec.ts
```

### Phase 3 — Iterate on failure, capped at 3 attempts

If the spec passes: run the static verifier and you are done.

```
npx nx g @finverity/workspace-plugin:verify-e2e --file apps/shop-e2e/src/<slug>.spec.ts
```

If the spec fails:

1. Read the Playwright error. The first failing line is usually all you need.
2. If a selector didn't match: go back to `browser_snapshot`, find the real
   node, update the selector. Do not guess a second variant of the same
   invented selector.
3. If a wait timed out: your assertion probably raced the app's async load.
   Add or tighten a `waitFor` / `expect.poll`.
4. Re-run the spec.

**Hard cap: 3 attempts total.** After the third failure, stop. Report:

- What the story asked for.
- Which assertion is failing.
- What you observed in the snapshot vs. what the assertion expected.
- Your best guess whether this is a spec bug or a real product bug.

Do not silently weaken assertions to make the test pass. A test that
passes only because you dropped the meaningful assertion is exactly the
failure mode this whole pipeline exists to prevent.

---

## Output Requirements

Generate a single Playwright spec file at:
`apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts`

### Spec rules
- One `test.describe(...)` block, 1–2 `test(...)` inside.
- Import `{ test, expect }` from `@playwright/test`.
- Selector preference: `getByRole` → `getByText` → CSS class matching real
  DOM. Never invent selectors — see verification loop below.
- Always `await locator.first().waitFor({ state: 'visible' })` (or
  `expect.poll`) before counting/asserting on lists.
- Include at least one **discriminating** assertion — one that would visibly
  fail if the feature under test regressed.

### Verification loop (do not skip)

1. **Explore first via Playwright MCP.** The `playwright` MCP server is
   registered in this workspace. Before writing the spec, use:
   - `browser_navigate` to open http://localhost:4200 at the relevant page
   - `browser_snapshot` to read the real accessibility tree
   - `browser_click` / `browser_fill_form` / `browser_select_option` to
     confirm the interaction from the story actually works
   Ground every selector in the snapshot. Never in imagination.

2. **Write the spec**, then run it:
   `cd apps/shop-e2e && npx playwright test src/supplier-filters-invoices-by.spec.ts`

3. **On failure, iterate — capped at 3 attempts total.** Read the Playwright
   error. If a selector missed, re-snapshot and fix. If a wait raced, tighten
   the wait. After the third failed attempt, stop and report:
   - which assertion is failing
   - what the snapshot showed vs. what the assertion expected
   - your best guess: spec bug or product bug

4. **Never** silently drop the discriminating assertion to make the test
   pass — that defeats the point of this pipeline.

5. When the spec passes, run the static gate:
   `npx nx g @funverity/workspace-plugin:verify-e2e --file apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts`
