## Why Nx in an agentic environment

Nx gives you the **deterministic scaffolding around a non-deterministic actor**. Every generator is a typed, schema-validated command — discoverable via `nx list`, invoked with validated args, backed by an atomic virtual filesystem (`Tree`) and workspace-aware helpers like `getProjects()`. The agent (or the sub-agent a generator spawns) never has to hallucinate paths, invent flags, or half-write files, because the sanctioned actions are defined by the workspace itself. In practice: the LLM writes the spec, but *Nx* decides where it lands, what context feeds it, and which quality gates it must pass. That's what turns agentic runs from snowflake demos into reproducible, CI-composable workflows — and it's why the same three commands work identically on stage, in local dev, and inside a pipeline.

---

## Demo commands

# 1) show generators
  nx list @funverity/workspace-plugin

# 2) run generate-e2e
  nx g generate-e2e --story "supplier filters invoices by APPROVED status"

  # --- hand prompt to Claude Code in another window ---
  #     "Read .github/prompts/generated/supplier-filters-invoices-by.prompt.md and follow it"

# 3) verify
  nx g verify-e2e --file apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts

# 4) break (edit spec — change one selector name, e.g. 'Filter' → 'Filtre')
  cd apps/shop-e2e && npx playwright test src/supplier-filters-invoices-by.spec.ts --ui

# 5) verify with heal
  nx g verify-e2e \
    --file apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts \
    --heal

   cd apps/shop-e2e && npx playwright test src/supplier-filters-invoices-by.spec.ts --ui


# 6) remove everything added
  rm -f apps/shop-e2e/src/supplier-filters-invoices-by.spec.ts \
        .github/prompts/generated/supplier-filters-invoices-by.prompt.md

# 7) oneshot
  nx g oneshot-e2e --story "supplier filters invoices by APPROVED status"


