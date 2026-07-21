import { type Tree, getProjects } from '@nx/devkit'
import { phase, step, ok, warn, err } from './console'

// ─── Types ──────────────────────────────────────────────
export interface ComposeOpts {
  story: string
  featureLib?: string
  referenceSpec?: string
}

export interface ComposeResult {
  slug: string
  promptPath: string
  predictedSpec: string
}

export interface ZephyrTestCase {
  key: string
  name: string
  objective?: string
  precondition?: string
  labels?: string[]
  priority?: { name: string }
  steps: { description: string; testData?: string; expectedResult?: string }[]
}

interface FeatureCtx {
  name: string
  path: string
  readme: string | null
  readmeSource: string
  fileCount: number
}

interface SpecCtx {
  content: string | null
  testCount: number
  imports: string
  describes: string[]
}

// ─── Zephyr (mocked) ────────────────────────────────────
/*
 * TODO: Enable real Zephyr / MCP fetch here once the workspace has an MCP
 * server configured. Until then we use the mock below so the generator can
 * demo end-to-end without credentials.
 */
export function mockFetchTestCase (story: string): ZephyrTestCase {
  const short = story.trim().replace(/\s+/g, ' ')
  return {
    key: `MOCK-${slugify(story).toUpperCase().slice(0, 12)}`,
    name: short,
    objective: `Verify the behaviour described by: "${short}"`,
    precondition:
      'App is running at http://localhost:4200. Default role is active.',
    priority: { name: 'Normal' },
    labels: ['mocked', 'e2e', 'demo'],
    steps: [
      {
        description: 'Navigate to the relevant page in the app',
        expectedResult: 'Page renders with visible content matching the story'
      },
      {
        description: 'Perform the user action described in the story',
        expectedResult: 'The UI responds as the story predicts'
      },
      {
        description: 'Assert the observable end state',
        expectedResult: 'End state is verifiable via role/text/CSS selectors'
      }
    ]
  }
}

// ─── Feature-lib resolver ───────────────────────────────
function countTsFiles (tree: Tree, dir: string): number {
  if (!tree.exists(dir)) return 0
  let n = 0
  for (const child of tree.children(dir)) {
    const full = `${dir}/${child}`
    if (tree.isFile(full)) {
      if (child.endsWith('.ts')) n++
    } else n += countTsFiles(tree, full)
  }
  return n
}

export function resolveFeatureLib (
  tree: Tree,
  hint: string | undefined,
  story: string
): FeatureCtx {
  const projects = getProjects(tree)
  const candidates: { name: string; root: string; score: number }[] = []

  if (hint) {
    for (const [name, cfg] of projects) {
      if (
        name === hint ||
        cfg.root.endsWith(`/${hint}`) ||
        cfg.root.includes(hint)
      ) {
        candidates.push({ name, root: cfg.root, score: 1000 })
      }
    }
  }

  if (!candidates.length) {
    const words = story.toLowerCase().match(/[a-z]{4,}/g) ?? []
    const stems = new Set<string>()
    for (const w of words) {
      stems.add(w)
      if (w.endsWith('ing')) stems.add(w.slice(0, -3))
      if (w.endsWith('es')) stems.add(w.slice(0, -2))
      if (w.endsWith('s')) stems.add(w.slice(0, -1))
      stems.add(w.slice(0, 5))
    }
    for (const [name, cfg] of projects) {
      if (!cfg.root.startsWith('libs/')) continue
      const nameLC = name.toLowerCase()
      const rootLC = cfg.root.toLowerCase()
      let score = 0
      for (const s of stems) {
        if (s.length < 4) continue
        if (nameLC.includes(s)) score += 2
        else if (rootLC.includes(s)) score += 1
      }
      if (score > 0) {
        if (/feature/i.test(name)) score += 3
        candidates.push({ name, root: cfg.root, score })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const chosen = candidates[0]

  if (!chosen) {
    return {
      name: hint ?? '(none)',
      path: hint ?? '(unresolved)',
      readme: null,
      readmeSource: '',
      fileCount: 0
    }
  }

  const readmePath = `${chosen.root}/README.md`
  const readme = tree.exists(readmePath) ? tree.read(readmePath, 'utf-8') : null
  return {
    name: chosen.name,
    path: chosen.root,
    readme,
    readmeSource: readme ? readmePath : '',
    fileCount: countTsFiles(tree, `${chosen.root}/src`)
  }
}

// ─── Reference-spec analyser ────────────────────────────
export function analyzeReferenceSpec (tree: Tree, specPath: string): SpecCtx {
  const ctx: SpecCtx = {
    content: null,
    testCount: 0,
    imports: '',
    describes: []
  }
  if (!tree.exists(specPath)) return ctx

  const content = tree.read(specPath, 'utf-8') ?? ''
  ctx.content = content
  ctx.testCount = (content.match(/\btest\(/g) ?? []).length

  const lines = content.split('\n')
  ctx.imports = lines.filter(l => l.startsWith('import ')).join('\n')

  const starts: number[] = []
  lines.forEach((l, i) => {
    if (/^\s*test\.describe\(/.test(l)) starts.push(i)
  })

  for (const s of starts.slice(0, 2)) {
    let depth = 0
    let end = s
    for (let i = s; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '(' || ch === '{') depth++
        if (ch === ')' || ch === '}') depth--
      }
      if (depth <= 0 && i > s) {
        end = i
        break
      }
    }
    ctx.describes.push(lines.slice(s, end + 1).join('\n'))
  }

  return ctx
}

// ─── Slug ───────────────────────────────────────────────
export function slugify (input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join('-') || 'story'
  )
}

function pickOutputPath (tree: Tree, baseSlug: string): string {
  const dir = '.github/prompts/generated'
  let candidate = `${dir}/${baseSlug}.prompt.md`
  let n = 2
  while (tree.exists(candidate)) {
    candidate = `${dir}/${baseSlug}-${n}.prompt.md`
    n++
  }
  return candidate
}

// ─── Prompt composer ────────────────────────────────────
function composePrompt (
  story: string,
  slug: string,
  tc: ZephyrTestCase,
  feat: FeatureCtx,
  spec: SpecCtx,
  guidelines: string | null
): string {
  const s: string[] = []

  s.push(`# E2E Test Generation — Context-Engineered Prompt

You are a Senior QA Automation Engineer generating a production-ready
Playwright e2e test for the funverity shop app. Follow the exact project
patterns shown below.`)

  s.push(`
## User Story
${story}`)

  s.push(`
## Test Case (${tc.key}) — mocked from story
**Name:** ${tc.name}
**Objective:** ${tc.objective ?? 'N/A'}
**Precondition:** ${tc.precondition ?? 'N/A'}
**Priority:** ${tc.priority?.name ?? 'N/A'}
**Labels:** ${(tc.labels ?? []).join(', ')}

### Steps
${tc.steps
  .map(
    (st, i) =>
      `${i + 1}. **Action:** ${st.description}\n   **Data:** ${
        st.testData ?? '—'
      }\n   **Expected:** ${st.expectedResult ?? '—'}`
  )
  .join('\n')}`)

  if (feat.readme) {
    s.push(`
## Feature Documentation (${feat.readmeSource})
${feat.readme}`)
  } else {
    s.push(`
## Feature Documentation
_README not found for ${feat.path}._ Derive test structure from the reference spec below.`)
  }

  if (spec.content) {
    s.push(`
## Reference Spec (${spec.content.split('\n').length} lines, ${
      spec.testCount
    } existing tests)

### Imports (mirror these)
\`\`\`typescript
${spec.imports}
\`\`\`

### Existing describe blocks (follow this pattern)
${spec.describes.map(d => `\`\`\`typescript\n${d}\n\`\`\``).join('\n')}`)
  }

  if (guidelines) {
    s.push(`
## House Style Guidelines (from .github/prompts/ae-playwright.md)
${guidelines}`)
  }

  s.push(`
## Output Requirements

Generate a single Playwright spec file at:
\`apps/shop-e2e/src/${slug}.spec.ts\`

### Spec rules
- One \`test.describe(...)\` block, 1–2 \`test(...)\` inside.
- Import \`{ test, expect }\` from \`@playwright/test\`.
- Selector preference: \`getByRole\` → \`getByText\` → CSS class matching real
  DOM. Never invent selectors — see verification loop below.
- Always \`await locator.first().waitFor({ state: 'visible' })\` (or
  \`expect.poll\`) before counting/asserting on lists.
- Include at least one **discriminating** assertion — one that would visibly
  fail if the feature under test regressed.

### Verification loop (do not skip)

1. **Explore first via Playwright MCP.** The \`playwright\` MCP server is
   registered in this workspace. Before writing the spec, use:
   - \`browser_navigate\` to open http://localhost:4200 at the relevant page
   - \`browser_snapshot\` to read the real accessibility tree
   - \`browser_click\` / \`browser_fill_form\` / \`browser_select_option\` to
     confirm the interaction from the story actually works
   Ground every selector in the snapshot. Never in imagination.

2. **Write the spec**, then run it:
   \`cd apps/shop-e2e && npx playwright test src/${slug}.spec.ts\`

3. **On failure, iterate — capped at 3 attempts total.** Read the Playwright
   error. If a selector missed, re-snapshot and fix. If a wait raced, tighten
   the wait. After the third failed attempt, stop and report:
   - which assertion is failing
   - what the snapshot showed vs. what the assertion expected
   - your best guess: spec bug or product bug

4. **Never** silently drop the discriminating assertion to make the test
   pass — that defeats the point of this pipeline.

5. When the spec passes, run the static gate:
   \`npx nx g @funverity/workspace-plugin:verify-e2e --file apps/shop-e2e/src/${slug}.spec.ts\`
`)

  return s.join('\n---\n')
}

// ─── Summary table ──────────────────────────────────────
function printSummary (
  tc: ZephyrTestCase,
  feat: FeatureCtx,
  spec: SpecCtx,
  guidelinesLoaded: boolean
): void {
  phase('Context Summary')
  warn(
    `Zephyr test case:    ${tc.key} — "${tc.name}" (mocked, ${tc.steps.length} steps)`
  )
  feat.readme
    ? ok(
        `Feature library:     ${feat.name} (${feat.path}, README ${
          feat.readme.split('\n').length
        } lines, ${feat.fileCount} .ts files)`
      )
    : warn(
        `Feature library:     ${feat.name} (${feat.path}, no README, ${feat.fileCount} .ts files)`
      )
  guidelinesLoaded
    ? ok('House-style guide:   .github/prompts/ae-playwright.md loaded')
    : err('House-style guide:   .github/prompts/ae-playwright.md NOT FOUND')
  spec.content
    ? ok(
        `Reference spec:      ${spec.testCount} existing tests, ${spec.describes.length} describe block(s) captured`
      )
    : warn('Reference spec:      not found')
}

// ─── Main entry ─────────────────────────────────────────
export function composeAndSavePrompt (
  tree: Tree,
  opts: ComposeOpts
): ComposeResult {
  const slug = slugify(opts.story)
  const referenceSpec =
    opts.referenceSpec ?? 'apps/shop-e2e/src/financing.spec.ts'

  phase('Phase 1: Gathering Context')

  step('Fetching test case (mocked — real MCP call is TODO)…')
  const tc = mockFetchTestCase(opts.story)
  warn(`Zephyr fetch mocked → ${tc.key}`)

  step('Resolving feature library…')
  const feat = resolveFeatureLib(tree, opts.featureLib, opts.story)
  feat.path !== '(unresolved)'
    ? ok(`Matched: ${feat.name} (${feat.path})`)
    : warn(
        `Could not resolve a lib from story keywords — passing empty context`
      )

  step(`Analysing reference spec (${referenceSpec})…`)
  const spec = analyzeReferenceSpec(tree, referenceSpec)
  spec.content
    ? ok(
        `${spec.testCount} existing tests, ${spec.describes.length} describe block(s) captured`
      )
    : warn(`Reference spec not found`)

  step('Loading house-style guidelines…')
  const guidelinesPath = '.github/prompts/ae-playwright.md'
  const guidelines = tree.exists(guidelinesPath)
    ? tree.read(guidelinesPath, 'utf-8')
    : null
  guidelines
    ? ok(`Loaded ${guidelinesPath}`)
    : warn(`${guidelinesPath} not found`)

  printSummary(tc, feat, spec, !!guidelines)

  phase('Phase 3: Composing Prompt')
  const composed = composePrompt(opts.story, slug, tc, feat, spec, guidelines)
  const promptPath = pickOutputPath(tree, slug)
  tree.write(promptPath, composed)
  ok(`Prompt written → ${promptPath}`)

  return {
    slug,
    promptPath,
    predictedSpec: `apps/shop-e2e/src/${slug}.spec.ts`
  }
}
