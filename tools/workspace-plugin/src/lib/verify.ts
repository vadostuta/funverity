import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { D, R, ok, warn, err, info, step, phase } from './console';

export interface VerifyResult {
  eslintOk: boolean;
  tscOk: boolean;
  structuralOk: boolean;
  eslintOutput: string;
  tscOutput: string;
  structuralIssues: string[];
}

export interface RuntimeResult {
  ok: boolean;
  elapsedSec: number;
  exitCode: number | null;
  output: string;
}

export function verifyGenerated(filePath: string): VerifyResult {
  phase('Verification');

  const result: VerifyResult = {
    eslintOk: false,
    tscOk: false,
    structuralOk: false,
    eslintOutput: '',
    tscOutput: '',
    structuralIssues: [],
  };

  if (!existsSync(filePath)) {
    err(`File not found: ${filePath}`);
    result.structuralIssues.push(`File not found: ${filePath}`);
    return result;
  }

  step('Running ESLint…');
  try {
    execSync(`npx eslint "${filePath}" --no-error-on-unmatched-pattern`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60_000,
    });
    ok('ESLint: clean');
    result.eslintOk = true;
  } catch (e) {
    const output = ((e as { stdout?: string; stderr?: string }).stdout ?? '') +
      ((e as { stdout?: string; stderr?: string }).stderr ?? '');
    result.eslintOutput = output;
    warn('ESLint: issues found');
    if (output.trim()) {
      console.log(
        `${D}${output.split('\n').slice(0, 15).map((l) => `    ${l}`).join('\n')}${R}`,
      );
    }
  }

  step('Running tsc --noEmit…');
  try {
    execSync(
      `npx tsc --noEmit --skipLibCheck --esModuleInterop --resolveJsonModule --target ES2020 --moduleResolution node "${filePath}"`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 60_000 },
    );
    ok('TypeScript: clean');
    result.tscOk = true;
  } catch (e) {
    const output = ((e as { stdout?: string; stderr?: string }).stdout ?? '') +
      ((e as { stdout?: string; stderr?: string }).stderr ?? '');
    const tsErrors = output.split('\n').filter((l) => l.includes('error TS'));
    if (tsErrors.length) {
      warn(`TypeScript: ${tsErrors.length} error(s)`);
      result.tscOutput = tsErrors.join('\n');
      console.log(`${D}${tsErrors.slice(0, 10).map((l) => `    ${l}`).join('\n')}${R}`);
    } else {
      ok('TypeScript: clean');
      result.tscOk = true;
    }
  }

  step('Validating structure…');
  try {
    const content = readFileSync(filePath, 'utf-8');
    const checks: { pass: boolean; label: string }[] = [
      { pass: /from\s+['"]@playwright\/test['"]/.test(content), label: 'Imports from @playwright/test' },
      { pass: /test\.describe\(/.test(content), label: 'Has test.describe(...)' },
      { pass: /\btest\(/.test(content), label: 'Has at least one test(...)' },
      { pass: /await\s+expect\(/.test(content), label: 'Uses await expect(...) assertions' },
      { pass: /page\.goto\(/.test(content), label: 'Navigates with page.goto(...)' },
    ];
    let allPass = true;
    for (const c of checks) {
      if (c.pass) {
        ok(c.label);
      } else {
        warn(`Missing: ${c.label}`);
        result.structuralIssues.push(`Missing: ${c.label}`);
        allPass = false;
      }
    }
    result.structuralOk = allPass;
  } catch {
    warn('Could not read file for structural checks');
    result.structuralIssues.push('Could not read file for structural checks');
  }

  return result;
}

export async function runPlaywright(specPath: string, workspaceRoot: string): Promise<RuntimeResult> {
  phase('Playwright Runtime Verification');
  const specRelative = specPath.replace(/^apps\/shop-e2e\//, '');
  info(`Running: cd apps/shop-e2e && npx playwright test ${specRelative}`);
  const start = Date.now();

  return new Promise((resolve) => {
    const chunks: string[] = [];
    const child = spawn('npx', ['playwright', 'test', specRelative, '--reporter=list'], {
      cwd: `${workspaceRoot}/apps/shop-e2e`,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never', CI: '1' },
    });

    child.stdout?.on('data', (d: Buffer) => {
      process.stdout.write(d);
      chunks.push(d.toString());
    });
    child.stderr?.on('data', (d: Buffer) => {
      process.stderr.write(d);
      chunks.push(d.toString());
    });

    child.on('exit', (code) => {
      const elapsedSec = Math.round((Date.now() - start) / 1000);
      const runtimeOk = code === 0;
      runtimeOk
        ? ok(`Playwright: passed in ${elapsedSec}s`)
        : err(`Playwright: exit code ${code ?? 'unknown'} after ${elapsedSec}s`);
      resolve({ ok: runtimeOk, elapsedSec, exitCode: code, output: chunks.join('') });
    });

    child.on('error', (e) => {
      err(`Failed to spawn playwright: ${e.message}`);
      resolve({ ok: false, elapsedSec: Math.round((Date.now() - start) / 1000), exitCode: null, output: e.message });
    });
  });
}
