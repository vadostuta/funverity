import { existsSync } from 'fs';
import { type Tree } from '@nx/devkit';
import type { VerifyE2ESchema } from './schema';
import { banner, phase, ok, warn, err, info, R, B, GREEN, RED, YELLOW } from '../../lib/console';
import { verifyGenerated, runPlaywright, type VerifyResult, type RuntimeResult } from '../../lib/verify';
import { spawnClaude, buildRetrySeed, buildClaudeArgs, fmtElapsed } from '../../lib/heal';

async function runOnce(file: string, workspaceRoot: string): Promise<{ staticResult: VerifyResult; runtimeResult: RuntimeResult; ok: boolean }> {
  const staticResult = verifyGenerated(file);
  const staticOk = staticResult.eslintOk && staticResult.tscOk && staticResult.structuralOk;
  const runtimeResult = await runPlaywright(file, workspaceRoot);
  return { staticResult, runtimeResult, ok: staticOk && runtimeResult.ok };
}

function printBox(
  file: string,
  staticResult: VerifyResult,
  runtimeResult: RuntimeResult,
  extraLine?: string,
): void {
  const staticOk = staticResult.eslintOk && staticResult.tscOk && staticResult.structuralOk;
  const allOk = staticOk && runtimeResult.ok;
  const colour = allOk ? GREEN : RED;
  const label = allOk ? 'PASS' : 'FAIL';

  console.log(`
${colour}${B}${'═'.repeat(58)}${R}
${colour}${B}  Spec:    ${file}${R}
${colour}${B}  Static:  ${staticOk ? 'PASS' : 'FAIL'}  (eslint ${staticResult.eslintOk ? '✓' : '✗'} | tsc ${staticResult.tscOk ? '✓' : '✗'} | structure ${staticResult.structuralOk ? '✓' : '✗'})${R}
${colour}${B}  Runtime: ${runtimeResult.ok ? 'PASS' : 'FAIL'}  (playwright ${runtimeResult.ok ? '✓' : '✗'} in ${runtimeResult.elapsedSec}s)${R}
${colour}${B}  Overall: ${label}${R}${extraLine ? `\n${colour}${B}  ${extraLine}${R}` : ''}
${colour}${B}${'═'.repeat(58)}${R}
`);
}

export default async function verifyE2E(_tree: Tree, opts: VerifyE2ESchema): Promise<void> {
  const heal = opts.heal === true;
  banner(heal
    ? 'NX E2E Verify — Static + Playwright runtime + Heal'
    : 'NX E2E Verify — Static + Playwright runtime');

  if (!opts.file || !opts.file.trim()) {
    err('--file is required (path to a Playwright spec).');
    process.exitCode = 1;
    return;
  }

  const workspaceRoot = process.cwd();
  const file = opts.file;

  phase('Phase 1: Static Verification');
  info(`Verifying: ${file}`);

  const initial = await runOnce(file, workspaceRoot);

  if (initial.ok || !heal) {
    printBox(file, initial.staticResult, initial.runtimeResult);
    if (!initial.ok) process.exitCode = 1;
    return;
  }

  // Heal loop
  const model = opts.model ?? 'sonnet';
  const timeoutMinutes = opts.timeoutMinutes ?? 10;
  const skipPermissions = opts.skipPermissions !== false;
  const maxRetries = Math.max(0, Math.floor(opts.maxRetries ?? 2));
  const totalAllowed = maxRetries + 1;
  const mcpConfigPath = `${workspaceRoot}/.mcp.json`;

  console.log(`
${YELLOW}${B}${'═'.repeat(58)}${R}
${YELLOW}${B}  ⚠️  Verification failed — invoking Claude to heal.${R}
${YELLOW}${B}${'═'.repeat(58)}${R}
${YELLOW}  Model:            ${model}
  Timeout per run:  ${timeoutMinutes} minute(s)
  Skip permissions: ${skipPermissions}
  MCP config:       ${existsSync(mcpConfigPath) ? mcpConfigPath : '(none — MCP tools unavailable)'}
  Max heal attempts: ${totalAllowed}
  Workspace root:   ${workspaceRoot}${R}
`);

  let staticResult = initial.staticResult;
  let runtimeResult = initial.runtimeResult;
  let attempt = 0;
  let totalClaudeSec = 0;
  let allOk = false;

  while (attempt < totalAllowed) {
    attempt++;
    const attemptLabel = `${attempt}/${totalAllowed}`;

    phase(`Heal Attempt ${attemptLabel} — Nested Claude (fix spec)`);

    const seed = buildRetrySeed(file, staticResult, runtimeResult, attemptLabel);
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
${RED}${B}  Nested claude exited with code ${exitCode} on heal attempt ${attemptLabel} (${fmtElapsed(claudeSec)}).${R}
${RED}${B}${'═'.repeat(58)}${R}
`);
      process.exitCode = exitCode;
      return;
    }

    ok(`Nested claude finished heal attempt ${attemptLabel} in ${fmtElapsed(claudeSec)}`);

    if (!existsSync(file)) {
      console.log(`
${RED}${B}${'═'.repeat(58)}${R}
${RED}${B}  Spec disappeared after claude exited: ${file}${R}
${RED}${B}${'═'.repeat(58)}${R}
`);
      process.exitCode = 1;
      return;
    }

    phase(`Re-verify (after heal attempt ${attemptLabel})`);
    const rerun = await runOnce(file, workspaceRoot);
    staticResult = rerun.staticResult;
    runtimeResult = rerun.runtimeResult;

    if (rerun.ok) {
      ok(`Heal attempt ${attemptLabel} passed all checks.`);
      allOk = true;
      break;
    }

    if (attempt < totalAllowed) {
      warn(`Heal attempt ${attemptLabel} still failing — retrying with fresh error context.`);
    } else {
      warn(`Heal attempt ${attemptLabel} still failing — heal budget exhausted (${totalAllowed} attempts).`);
    }
  }

  const attemptNote = allOk
    ? `Healed on attempt ${attempt}/${totalAllowed} (${fmtElapsed(totalClaudeSec)} claude time)`
    : `Heal exhausted after ${totalAllowed} attempts (${fmtElapsed(totalClaudeSec)} claude time)`;

  printBox(file, staticResult, runtimeResult, attemptNote);
  if (!allOk) process.exitCode = 1;
}
