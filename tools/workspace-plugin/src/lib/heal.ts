import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { warn, err } from './console';
import type { VerifyResult, RuntimeResult } from './verify';

export interface SpawnClaudeArgs {
  claudeArgs: string[];
  workspaceRoot: string;
  timeoutMinutes: number;
}

export interface SpawnClaudeResult {
  exitCode: number;
  elapsedSec: number;
}

export function fmtElapsed(sec: number): string {
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export async function spawnClaude({
  claudeArgs,
  workspaceRoot,
  timeoutMinutes,
}: SpawnClaudeArgs): Promise<SpawnClaudeResult> {
  const started = Date.now();
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn('claude', claudeArgs, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: process.env,
    });

    const timeout = setTimeout(() => {
      warn(`Nested claude exceeded ${timeoutMinutes} minute(s) — killing.`);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeoutMinutes * 60_000);

    child.on('exit', (code) => {
      clearTimeout(timeout);
      resolve(code ?? 1);
    });
    child.on('error', (e) => {
      clearTimeout(timeout);
      err(`Failed to spawn claude: ${e.message}`);
      resolve(1);
    });
  });
  const elapsedSec = Math.round((Date.now() - started) / 1000);
  return { exitCode, elapsedSec };
}

export function buildRetrySeed(
  predictedSpec: string,
  staticResult: VerifyResult,
  runtime: RuntimeResult,
  attemptLabel: string,
): string {
  const specContent = existsSync(predictedSpec)
    ? readFileSync(predictedSpec, 'utf-8')
    : '(file not found)';
  const staticIssues: string[] = [];
  if (!staticResult.eslintOk) {
    staticIssues.push(`ESLint failed:\n${staticResult.eslintOutput.split('\n').slice(0, 20).join('\n')}`);
  }
  if (!staticResult.tscOk) {
    staticIssues.push(`TypeScript failed:\n${staticResult.tscOutput.split('\n').slice(0, 20).join('\n')}`);
  }
  if (!staticResult.structuralOk) {
    staticIssues.push(`Structural checks failed:\n${staticResult.structuralIssues.join('\n')}`);
  }

  const runtimeLog = runtime.ok
    ? '(runtime passed)'
    : runtime.output.split('\n').slice(-80).join('\n');

  return `Retry ${attemptLabel}: the Playwright spec at \`${predictedSpec}\` did not fully pass verification. Fix it.

Current spec content:
\`\`\`typescript
${specContent}
\`\`\`

STATIC VERIFICATION ISSUES:
${staticIssues.length ? staticIssues.join('\n\n') : '(static verification passed)'}

PLAYWRIGHT RUNTIME OUTPUT (last 80 lines):
\`\`\`
${runtimeLog}
\`\`\`

Your job: fix the spec so both static (eslint, tsc, structural) AND playwright checks pass. Rules:
- If a selector is failing, use Playwright MCP \`browser_navigate\` + \`browser_snapshot\` to re-inspect the real DOM. Do not guess.
- Never silently drop the discriminating assertion to make the test pass. That defeats the whole pipeline.
- Write the fixed spec to the same file: \`${predictedSpec}\`.
- Run playwright yourself to confirm before exiting.

When done, stop and print the absolute path.`;
}

export interface BuildClaudeArgsOpts {
  seed: string;
  model: string;
  workspaceRoot: string;
  skipPermissions: boolean;
  mcpConfigPath?: string;
}

export function buildClaudeArgs({
  seed,
  model,
  workspaceRoot,
  skipPermissions,
  mcpConfigPath,
}: BuildClaudeArgsOpts): string[] {
  const args: string[] = [
    '-p', seed,
    '--model', model,
    '--add-dir', workspaceRoot,
  ];
  if (skipPermissions) args.push('--dangerously-skip-permissions');
  if (mcpConfigPath && existsSync(mcpConfigPath)) {
    args.push('--mcp-config', mcpConfigPath);
  }
  return args;
}
