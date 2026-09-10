/**
 * Production-safe migrate deploy with recovery for known P3009.
 *
 * Production DB has a failed row for:
 *   20260909093000_account_type_separation
 * That folder was removed from the repo (superseded by 20260909090000_*).
 * Prisma refuses all further deploys until it is resolved → app crash-loop → 502.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const KNOWN_FAILED = ['20260909093000_account_type_separation'];

const candidates = [
  join(process.cwd(), 'prisma', 'schema.prisma'),
  join(process.cwd(), 'backend', 'prisma', 'schema.prisma'),
  join(__dirname, '..', 'prisma', 'schema.prisma'),
];

const schema = candidates.find((p) => existsSync(p));
if (!schema) {
  console.error('[prisma-migrate] schema.prisma not found');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args) {
  const r = spawnSync(npx, ['prisma', ...args, '--schema', schema], {
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (out) process.stdout.write(out);
  return { status: r.status === null ? 1 : r.status, out };
}

console.log('[prisma-migrate] deploy with schema:', schema);
let result = run(['migrate', 'deploy']);

if (result.status === 0) {
  console.log('[prisma-migrate] OK');
  process.exit(0);
}

const m = result.out.match(/The `([^`]+)` migration started at .+ failed/);
const name = m && m[1];

if (name && KNOWN_FAILED.includes(name)) {
  console.warn(
    `[prisma-migrate] P3009: resolving known-failed migration as rolled-back: ${name}`,
  );
  const resolved = run(['migrate', 'resolve', '--rolled-back', name]);
  if (resolved.status !== 0) {
    console.error('[prisma-migrate] resolve --rolled-back failed');
    process.exit(resolved.status || 1);
  }
  console.log('[prisma-migrate] retrying migrate deploy…');
  result = run(['migrate', 'deploy']);
  if (result.status === 0) {
    console.log('[prisma-migrate] OK after resolve');
    process.exit(0);
  }
}

console.error('[prisma-migrate] deploy failed — refusing to start the API');
process.exit(result.status || 1);
