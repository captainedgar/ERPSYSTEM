import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const packageRoot = resolve(import.meta.dirname, '..');
const scriptPath = resolve(
  packageRoot,
  'scripts/sync-company-role-permissions.mjs',
);

test('RBAC sync requires explicit confirmation', () => {
  let output = '';
  try {
    execFileSync(process.execPath, [scriptPath], {
      cwd: packageRoot,
      env: {
        ...process.env,
        CONFIRM_SYNC_RBAC: '',
        DATABASE_URL: 'postgresql://demo:demo@localhost:5432/demo',
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
  assert.match(output, /CONFIRM_SYNC_RBAC=true/);
});

test('RBAC sync is non-destructive and uses the canonical matrix', async () => {
  const source = await readFile(scriptPath, 'utf8');
  assert.doesNotMatch(source, /\.(delete|deleteMany)\s*\(/);
  assert.match(source, /apps\/api\/src\/roles\/company-role-permissions\.json/);
  assert.match(source, /rolePermission\.create/);
  assert.match(source, /incompatiblesNeutralizados/);
});
