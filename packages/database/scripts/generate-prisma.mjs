import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = dirname(scriptDir);
const workspaceRoot = join(packageDir, '..', '..');
const clientIndexPath = join(
  workspaceRoot,
  'node_modules/.prisma/client/index.js',
);
const enginePath = join(
  workspaceRoot,
  'node_modules/.prisma/client/query_engine-windows.dll.node',
);

const command = 'npx dotenv -e ../../.env -- prisma generate';
const result = spawnSync(command, {
  cwd: packageDir,
  encoding: 'utf8',
  shell: true,
  stdio: 'pipe',
});

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status === 0) {
  process.exit(0);
}

const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const hasWindowsEngineLock =
  combinedOutput.includes('EPERM: operation not permitted, rename') &&
  combinedOutput.includes('query_engine-windows.dll.node');

const hasUsableGeneratedClient =
  existsSync(clientIndexPath) &&
  existsSync(enginePath) &&
  readFileSync(clientIndexPath, 'utf8').includes('"copyEngine": true');

if (hasWindowsEngineLock && hasUsableGeneratedClient) {
  process.stderr.write(
    'Prisma generate hit a Windows file lock, but an existing generated client is valid. Continuing.\n',
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
