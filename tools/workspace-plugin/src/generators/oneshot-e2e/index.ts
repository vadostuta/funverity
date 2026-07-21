import { existsSync } from 'fs';
import { type Tree } from '@nx/devkit';
import type { OneshotE2ESchema } from './schema';
import { banner, phase, step, ok, warn, err, info, R, B, GREEN, RED, YELLOW } from '../../lib/console';
import { verifyGenerated, runPlaywright, type VerifyResult, type RuntimeResult } from '../../lib/verify';
import { composeAndSavePrompt } from '../../lib/compose';
import { spawnClaude, buildRetrySeed, buildClaudeArgs, fmtElapsed } from '../../lib/heal';

function buildSeedPrompt(slug: string, promptPath: string, predictedSpec: string): string {
  return `Read the file \`${promptPath}\` in this workspace and follow it exactly.

Your job:
1. Explore the app first using the Playwright MCP server (\`browser_navigate\` to http://localhost:4200, then \`browser_snapshot\` to read the real accessibility tree). Ground every selector in what you see.
2. Write the Playwright spec described by the prompt to \`${predictedSpec}\`.
3. Run it with \`cd apps/shop-e2e && npx playwright test src/${slug}.spec.ts\`.
4. If it fails, iterate — capped at 3 attempts. Never silently drop the discriminating assertion.

When the spec passes Playwright, stop and print the absolute path of the file you wrote. Do not open a code review, do not run additional commands beyond what the prompt describes.`;
}

export default async function oneshotE2E(tree: Tree, opts: OneshotE2ESchema) {
  banner('NX E2E One-Shot — compose → invoke Claude → verify (with retry)');

  if (!opts.story || !opts.story.trim()) {
    err('--story is required (plain english user story).');
    process.exitCode = 1;
    return;
  }

  const { slug, promptPath, predictedSpec } = composeAndSavePrompt(tree, {
    story: opts.story,
    featureLib: opts.featureLib,
    referenceSpec: opts.referenceSpec,
  });

  const model = opts.model ?? 'sonnet';
  const timeoutMinutes = opts.timeoutMinutes ?? 10;
  const skipPermissions = opts.skipPermissions !== false;
  const maxRetries = Math.max(0, Math.floor(opts.maxRetries ?? 2));
  const totalAllowed = maxRetries + 1;
  const workspaceRoot = process.cwd();
  const mcpConfigPath = `${workspaceRoot}/.mcp.json`;

  return async () => {
    console.log(`
${YELLOW}${B}${'═'.repeat(58)}${R}
${YELLOW}${B}  ⚠️  Invoking Claude in headless mode.${R}
${YELLOW}${B}${'═'.repeat(58)}${R}
${YELLOW}  Model:            ${model}
  Timeout per run:  ${timeoutMinutes} minute(s)
  Skip permissions: ${skipPermissions}
  MCP config:       ${existsSync(mcpConfigPath) ? mcpConfigPath : '(none — MCP tools unavailable)'}
  Max retries:      ${maxRetries} (up to ${totalAllowed} total attempts)
  Workspace root:   ${workspaceRoot}${R}
`);

    const overallStart = Date.now();
    let attempt = 0;
    let staticResult: VerifyResult | null = null;
    let runtimeResult: RuntimeResult | null = null;
    let totalClaudeSec = 0;
    let totalPlaywrightSec = 0;

    while (attempt < totalAllowed) {
      attempt++;
      const isFirst = attempt === 1;
      const attemptLabel = `${attempt}/${totalAllowed}`;

      phase(isFirst
        ? `Phase 4: Nested Claude — attempt ${attemptLabel} (write spec)`
        : `Phase 4: Nested Claude — attempt ${attemptLabel} (fix spec)`);

      const seed = isFirst
        ? buildSeedPrompt(slug, promptPath, predictedSpec)
        : buildRetrySeed(predictedSpec, staticResult!, runtimeResult!, attemptLabel);

      const claudeArgs = buildClaudeArgs({
        seed,
        model,
        workspaceRoot,
        skipPermissions,
        mcpConfigPath,
      });

      info(`Spawning: claude ${claudeArgs.map((a) => (a.includes(' ') || a.includes('\n') ? `"${a.slice(0, 60).replace(/\n/g, ' ')}${a.length > 60 ? '…' : ''}"` : a)).join(' ')}`);

      const { exitCode, elapsedSec: claudeSec } = await spawnClaude({ claudeArgs, workspaceRoot, timeoutMinutes });
      totalClaudeSec += claudeSec;

      if (exitCode !== 0) {
        console.log(`
${RED}${B}${'═'.repeat(58)}${R}
${RED}${B}  Nested claude exited with code ${exitCode} on attempt ${attemptLabel} (${fmtElapsed(claudeSec)}).${R}
${RED}${B}${'═'.repeat(58)}${R}
`);
        process.exitCode = exitCode;
        return;
      }

      ok(`Nested claude finished attempt ${attemptLabel} in ${fmtElapsed(claudeSec)}`);

      if (!existsSync(predictedSpec)) {
        console.log(`
${RED}${B}${'═'.repeat(58)}${R}
${RED}${B}  Predicted spec not found on disk after claude exited (attempt ${attemptLabel}).${R}
${RED}${B}  Expected: ${predictedSpec}${R}
${RED}${B}${'═'.repeat(58)}${R}
`);
        process.exitCode = 1;
        return;
      }

      phase(`Phase 5: Static Verification (attempt ${attemptLabel})`);
      step(`Verifying ${predictedSpec}`);
      staticResult = verifyGenerated(predictedSpec);
      const staticOk = staticResult.eslintOk && staticResult.tscOk && staticResult.structuralOk;

      runtimeResult = await runPlaywright(predictedSpec, workspaceRoot);
      totalPlaywrightSec += runtimeResult.elapsedSec;

      if (staticOk && runtimeResult.ok) {
        ok(`Attempt ${attemptLabel} passed all checks.`);
        break;
      }

      if (attempt < totalAllowed) {
        warn(`Attempt ${attemptLabel} failed — retrying with error context.`);
      } else {
        warn(`Attempt ${attemptLabel} failed — retry budget exhausted (${totalAllowed} attempts).`);
      }
    }

    const staticFinal = staticResult!;
    const runtimeFinal = runtimeResult!;
    const staticOk = staticFinal.eslintOk && staticFinal.tscOk && staticFinal.structuralOk;
    const allOk = staticOk && runtimeFinal.ok;

    const totalSec = Math.round((Date.now() - overallStart) / 1000);
    const colour = allOk ? GREEN : RED;
    const label = allOk ? 'PASS' : 'FAIL';
    const attemptNote = allOk
      ? (attempt > 1 ? ` (fixed on attempt ${attempt}/${totalAllowed})` : ` (first attempt)`)
      : ` (exhausted ${totalAllowed} attempts)`;

    console.log(`
${colour}${B}${'═'.repeat(58)}${R}
${colour}${B}  Story:   "${opts.story}"${R}
${colour}${B}  Spec:    ${predictedSpec}${R}
${colour}${B}  Static:  ${staticOk ? 'PASS' : 'FAIL'}  (eslint ${staticFinal.eslintOk ? '✓' : '✗'} | tsc ${staticFinal.tscOk ? '✓' : '✗'} | structure ${staticFinal.structuralOk ? '✓' : '✗'})${R}
${colour}${B}  Runtime: ${runtimeFinal.ok ? 'PASS' : 'FAIL'}  (playwright ${runtimeFinal.ok ? '✓' : '✗'} in ${runtimeFinal.elapsedSec}s last run)${R}
${colour}${B}  Overall: ${label}${attemptNote}${R}
${colour}${B}  Total elapsed: ${fmtElapsed(totalSec)} (${fmtElapsed(totalClaudeSec)} claude + ${totalPlaywrightSec}s playwright)${R}
${colour}${B}${'═'.repeat(58)}${R}
`);

    if (!allOk) process.exitCode = 1;
  };
}
