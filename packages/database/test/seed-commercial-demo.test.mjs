import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const packageRoot = resolve(import.meta.dirname, '..');
const scriptPath = resolve(packageRoot, 'scripts/seed-commercial-demo.mjs');
const localDatabaseUrl = 'postgresql://demo:demo@localhost:5432/demo';

function runSeed(env) {
  try {
    execFileSync(process.execPath, [scriptPath], {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: localDatabaseUrl, ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return '';
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
}

test('commercial demo seed requires explicit confirmation', () => {
  const output = runSeed({ CONFIRM_SEED_DEMO: '', NODE_ENV: 'test' });
  assert.match(output, /CONFIRM_SEED_DEMO=true/);
});

test('commercial demo seed is blocked in production', () => {
  const output = runSeed({ CONFIRM_SEED_DEMO: 'true', NODE_ENV: 'production' });
  assert.match(output, /bloqueado cuando NODE_ENV=production/);
});

test('commercial demo seed contains no destructive Prisma operations', async () => {
  const source = await readFile(scriptPath, 'utf8');
  assert.doesNotMatch(source, /\.(delete|deleteMany)\s*\(/);
  assert.match(source, /company\.upsert/);
  assert.match(source, /productBranchStock\.upsert/);
  assert.match(source, /platformUser\.upsert/);
  assert.match(source, /companyId_branchId_productId/);
});
