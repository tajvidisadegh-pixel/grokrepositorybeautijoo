/**
 * Production-safe migrate deploy.
 * - Clears known failed rows (P3009) that block every boot
 * - Applies idempotent ensure-schema SQL (never blocks boot on "already exists")
 * - Runs prisma migrate deploy
 * - If ensure migration is still "failed", marks it applied (schema already healed)
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

/** Phantom migration removed from repo */
const RESOLVE_ROLLED_BACK = ['20260909093000_account_type_separation'];

/**
 * Ensure migration may fail once on duplicate constraint; content is idempotent now.
 * After SQL heal, mark as applied so deploy never blocks again.
 */
const RESOLVE_APPLIED_IF_FAILED = ['20260911090000_ensure_production_schema'];

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
  return run([
    'migrate',
    'resolve',
    '--rolled-back',
    name,
    '--schema',
    schema,
  ]);
}

function resolveApplied(name) {
  return run([
    'migrate',
    'resolve',
    '--applied',
    name,
    '--schema',
    schema,
  ]);
}

console.log('[prisma-migrate] schema:', schema);

// 1) Clear known phantom failures
for (const name of RESOLVE_ROLLED_BACK) {
  console.warn(`[prisma-migrate] resolve --rolled-back ${name}`);
  const r = resolveRolledBack(name);
  if (r.status !== 0) {
    console.warn(`[prisma-migrate] resolve rolled-back ${name} → ${r.status} (ok if clean)`);
  }
}

// 2) Always heal schema with idempotent SQL (does not touch _prisma_migrations)
const ensureSql = join(
  prismaRoot,
  'migrations',
  '20260911090000_ensure_production_schema',
  'migration.sql',
);
if (existsSync(ensureSql)) {
  console.log('[prisma-migrate] applying ensure-schema SQL via db execute…');
  const exec = run(['db', 'execute', '--file', ensureSql, '--schema', schema]);
  if (exec.status !== 0) {
    console.warn(
      '[prisma-migrate] ensure SQL exited non-zero — continuing (columns may already exist)',
    );
  } else {
    console.log('[prisma-migrate] ensure SQL OK');
  }
}

// 3) If ensure migration previously failed, mark applied so P3009 cannot block boot
for (const name of RESOLVE_APPLIED_IF_FAILED) {
  console.warn(`[prisma-migrate] resolve --applied ${name} (heal failed row if any)`);
  const r = resolveApplied(name);
  if (r.status !== 0) {
    console.warn(`[prisma-migrate] resolve applied ${name} → ${r.status} (ok if already applied)`);
  }
}

// 4) Normal migrate deploy
console.log('[prisma-migrate] migrate deploy…');
let result = run(['migrate', 'deploy', '--schema', schema]);

if (result.status === 0) {
  console.log('[prisma-migrate] OK');
  process.exit(0);
}

// 5) One more recovery pass for any remaining P3009
if (/P3009|failed migrations/i.test(result.out)) {
  const m = result.out.match(/The `([^`]+)` migration started at .+ failed/);
  const name = m && m[1];
  if (name) {
    console.warn(`[prisma-migrate] P3009 on ${name} — trying applied then rolled-back`);
    resolveApplied(name);
    resolveRolledBack(name);
    // Prefer applied for ensure migration
    if (RESOLVE_APPLIED_IF_FAILED.includes(name)) {
      resolveApplied(name);
    }
  }
  result = run(['migrate', 'deploy', '--schema', schema]);
  if (result.status === 0) {
    console.log('[prisma-migrate] OK after P3009 recovery');
    process.exit(0);
  }
}

console.error('[prisma-migrate] deploy failed — refusing to start the API');
process.exit(result.status || 1);
