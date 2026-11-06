/**
 * Resolve Prisma schema for Liara / monorepo / local, then run prisma generate.
 * Liara sets cwd to the app root; if Root Directory is wrong, schema may be under backend/prisma.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const candidates = [
  join(process.cwd(), 'prisma', 'schema.prisma'),
  join(process.cwd(), 'backend', 'prisma', 'schema.prisma'),
  join(__dirname, '..', 'prisma', 'schema.prisma'),
];

const schema = candidates.find((p) => existsSync(p));

if (!schema) {
  console.error('[prisma-generate] schema.prisma not found. Tried:');
  for (const p of candidates) console.error('  -', p);
  console.error('[prisma-generate] cwd=', process.cwd());
  try {
    const { readdirSync } = require('fs');
    console.error('[prisma-generate] cwd listing:', readdirSync(process.cwd()).join(', '));
  } catch (_) {}
  process.exit(1);
}

console.log('[prisma-generate] using schema:', schema);
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'generate', '--schema', schema],
  { stdio: 'inherit', shell: true, env: process.env },
);
process.exit(result.status === null ? 1 : result.status);
