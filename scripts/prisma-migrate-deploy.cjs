/**
 * Production-safe migrate deploy with recovery for known P3009.
 *
 * Production DB may still have a failed row for:
 *   20260909093000_account_type_separation
 * (folder removed from repo; superseded by 20260909090000_*).
 * Prisma refuses all further deploys until it is resolved → crash-loop → 502.
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
  console.log('[prisma-migrate] $ npx prisma', args.join(' '));
  const r = spawnSync(npx, ['prisma', ...args, '--schema', schema], {
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (out) process.stdout.write(out);
  return { status: r.status === null ? 1 : r.status, out };
}

console.log('[prisma-migrate] schema:', schema);

// Proactively clear known failed rows (safe if already resolved / missing)
for (const name of KNOWN_FAILED) {
  console.warn(`[prisma-migrate] ensuring known-failed is rolled-back: ${name}`);
  const resolved = run(['migrate', 'resolve', '--rolled-back', name]);
  // status 0 = marked; non-zero usually means already applied/resolved or not found — continue
  if (resolved.status !== 0) {
    console.warn(
      `[prisma-migrate] resolve --rolled-back exited ${resolved.status} (ok if already clean)`,
    );
  }
}

console.log('[prisma-migrate] migrate deploy…');
let result = run(['migrate', 'deploy']);

if (result.status === 0) {
  console.log('[prisma-migrate] OK');
  process.exit(0);
}

// Retry once more if P3009 still present
if (/P3009|failed migrations/i.test(result.out)) {
  const m = result.out.match(/The `([^`]+)` migration started at .+ failed/);
  const name = (m && m[1]) || KNOWN_FAILED[0];
  console.warn(`[prisma-migrate] still blocked; resolve again: ${name}`);
  run(['migrate', 'resolve', '--rolled-back', name]);
  // also try --applied in case schema changes already exist in DB
  run(['migrate', 'resolve', '--applied', name]);
  result = run(['migrate', 'deploy']);
  if (result.status === 0) {
    console.log('[prisma-migrate] OK after second resolve');
    process.exit(0);
  }
}

console.error('[prisma-migrate] deploy failed — refusing to start the API');
process.exit(result.status || 1);
