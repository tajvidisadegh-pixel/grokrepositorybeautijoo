/**
 * Production-safe migrate deploy + runtime schema heal.
 * Always runs prisma/sql/ensure-runtime.sql so missing columns never crash the API.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const RESOLVE_ROLLED_BACK = ['20260909093000_account_type_separation'];
const RESOLVE_APPLIED_IF_FAILED = [
  '20260911090000_ensure_production_schema',
  '20260911120000_align_missing_columns',
];

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

const prismaRoot = join(schema, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args) {
  console.log('[prisma-migrate] $ npx prisma', args.join(' '));
  const r = spawnSync(npx, ['prisma', ...args], {
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (out) process.stdout.write(out);
  return { status: r.status === null ? 1 : r.status, out };
}

function resolveRolledBack(name) {
  return run(['migrate', 'resolve', '--rolled-back', name, '--schema', schema]);
}
function resolveApplied(name) {
  return run(['migrate', 'resolve', '--applied', name, '--schema', schema]);
}

console.log('[prisma-migrate] schema:', schema);

for (const name of RESOLVE_ROLLED_BACK) {
  console.warn(`[prisma-migrate] resolve --rolled-back ${name}`);
  const r = resolveRolledBack(name);
  if (r.status !== 0) {
    console.warn(`[prisma-migrate] resolve rolled-back ${name} → ${r.status}`);
  }
}

// Primary heal path: always run ensure-runtime.sql (independent of migration history)
const ensurePaths = [
  join(prismaRoot, 'sql', 'ensure-runtime.sql'),
  join(prismaRoot, 'migrations', '20260911120000_align_missing_columns', 'migration.sql'),
  join(prismaRoot, 'migrations', '20260911090000_ensure_production_schema', 'migration.sql'),
];
for (const ensureSql of ensurePaths) {
  if (!existsSync(ensureSql)) continue;
  console.log('[prisma-migrate] db execute', ensureSql);
  const exec = run(['db', 'execute', '--file', ensureSql, '--schema', schema]);
  if (exec.status !== 0) {
    console.warn(`[prisma-migrate] execute non-zero for ${ensureSql} — continuing`);
  } else {
    console.log('[prisma-migrate] execute OK:', ensureSql);
  }
}

for (const name of RESOLVE_APPLIED_IF_FAILED) {
  console.warn(`[prisma-migrate] resolve --applied ${name}`);
  const r = resolveApplied(name);
  if (r.status !== 0) {
    console.warn(`[prisma-migrate] resolve applied ${name} → ${r.status}`);
  }
}

console.log('[prisma-migrate] migrate deploy…');
let result = run(['migrate', 'deploy', '--schema', schema]);

if (result.status === 0) {
  console.log('[prisma-migrate] OK');
  process.exit(0);
}

if (/P3009|failed migrations/i.test(result.out)) {
  const m = result.out.match(/The `([^`]+)` migration started at .+ failed/);
  const name = m && m[1];
  if (name) {
    console.warn(`[prisma-migrate] P3009 on ${name} — mark applied`);
    resolveApplied(name);
  }
  result = run(['migrate', 'deploy', '--schema', schema]);
  if (result.status === 0) {
    console.log('[prisma-migrate] OK after P3009 recovery');
    process.exit(0);
  }
}

// Last resort: schema already healed via SQL; start API even if migrate history is messy
console.warn(
  '[prisma-migrate] migrate deploy still failing — starting API anyway after SQL heal',
);
process.exit(0);
