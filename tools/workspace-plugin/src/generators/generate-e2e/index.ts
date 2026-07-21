import { existsSync } from 'fs'
import { type Tree } from '@nx/devkit'
import type { GenerateE2ESchema } from './schema'
import { banner, err, info, R, B, GREEN, RED, D } from '../../lib/console'
import { verifyGenerated, runPlaywright } from '../../lib/verify'
import { composeAndSavePrompt } from '../../lib/compose'

export default async function generateE2E (
  tree: Tree,
  opts: GenerateE2ESchema
): Promise<void> {
  banner('NX E2E Test Generator — Context-Engineering Demo')

  if (!opts.story || !opts.story.trim()) {
    err('--story is required (plain english user story).')
    return
  }

  const { slug, promptPath, predictedSpec } = composeAndSavePrompt(tree, {
    story: opts.story,
    featureLib: opts.featureLib,
    referenceSpec: opts.referenceSpec
  })

  if (opts.verify === false) {
    console.log(`
${GREEN}${B}${'═'.repeat(58)}${R}
${GREEN}${B}  Prompt ready (verify skipped).${R}
${GREEN}${B}${'═'.repeat(58)}${R}
${D}  Next steps:
  1. Open ${promptPath} in Claude Code and follow it — the agent will
     write ${predictedSpec}.
  2. Verify with:
       npx nx g @funverity/workspace-plugin:verify-e2e --file ${predictedSpec}
  3. Run the spec:
       cd apps/shop-e2e && npx playwright test src/${slug}.spec.ts${R}
`)
    return
  }

  if (!existsSync(predictedSpec)) {
    console.log(`
${GREEN}${B}${'═'.repeat(58)}${R}
${GREEN}${B}  Prompt ready.${R}
${GREEN}${B}${'═'.repeat(58)}${R}
${D}  No spec at ${predictedSpec} yet.
  1. Open ${promptPath} in Claude Code and follow it — the agent will
     write ${predictedSpec}.
  2. Re-run this same command to auto-verify:
       npx nx g @funverity/workspace-plugin:generate-e2e \\
         --story "${opts.story.replace(/"/g, '\\"')}"${R}
`)
    return
  }

  info(`Spec found at ${predictedSpec} — running verification`)
  const result = verifyGenerated(predictedSpec)
  const staticOk = result.eslintOk && result.tscOk && result.structuralOk

  const runtime = await runPlaywright(predictedSpec, process.cwd())

  const allOk = staticOk && runtime.ok
  const colour = allOk ? GREEN : RED
  const label = allOk ? 'PASS' : 'FAIL'
  console.log(`
${colour}${B}${'═'.repeat(58)}${R}
${colour}${B}  Story:   "${opts.story}"${R}
${colour}${B}  Spec:    ${predictedSpec}${R}
${colour}${B}  Static:  ${staticOk ? 'PASS' : 'FAIL'}  (eslint ${
    result.eslintOk ? '✓' : '✗'
  } | tsc ${result.tscOk ? '✓' : '✗'} | structure ${
    result.structuralOk ? '✓' : '✗'
  })${R}
${colour}${B}  Runtime: ${runtime.ok ? 'PASS' : 'FAIL'}  (playwright ${
    runtime.ok ? '✓' : '✗'
  } in ${runtime.elapsedSec}s)${R}
${colour}${B}  Overall: ${label}${R}
${colour}${B}${'═'.repeat(58)}${R}
`)
  if (!allOk) process.exitCode = 1
}
