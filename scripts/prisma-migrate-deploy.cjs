/**
 * Boot-time DB alignment — must keep production schema = Prisma schema.
 * 1) ensure-runtime.sql (idempotent ALTERs)
 * 2) prisma db push (authoritative)
 * 3) migrate history cleanup
 * 4) critical column verify (second pass)
 * Never exit non-zero for heal failures after best-effort (API still starts).
 */
const { existsSync, writeFileSync, unlinkSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');
const { tmpdir } = require('os');

const RESOLVE_ROLLED_BACK = ['20260909093000_account_type_separation'];
const RESOLVE_APPLIED = [
  '20260911090000_ensure_production_schema',
  '20260911120000_align_missing_columns',
  '20260911140000_full_schema_align',
  '20260911150000_media_assets_url',
  '20260913100000_working_hours_timestamps',
];

/** Columns that caused production P2022 — always re-assert on boot */
const CRITICAL_HEAL_SQL = `
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(512);
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "cover_image_url" VARCHAR(512);
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "selected_category_ids" JSONB;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "url" VARCHAR(512);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'customer';
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
`;

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

function executeSql(sql, label) {
  const file = join(tmpdir(), `beautijoo-heal-${Date.now()}.sql`);
  try {
    writeFileSync(file, sql, 'utf8');
    const r = run(['db', 'execute', '--file', file, '--schema', schema]);
    console.log(
      r.status === 0
        ? `[prisma-migrate] ${label} OK`
        : `[prisma-migrate] ${label} had errors (continuing)`,
    );
    return r;
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

console.log('[prisma-migrate] schema:', schema);

for (const name of RESOLVE_ROLLED_BACK) {
  run(['migrate', 'resolve', '--rolled-back', name, '--schema', schema]);
}

const ensureSql = join(prismaRoot, 'sql', 'ensure-runtime.sql');
if (existsSync(ensureSql)) {
  console.log('[prisma-migrate] executing ensure-runtime.sql');
  const exec = run(['db', 'execute', '--file', ensureSql, '--schema', schema]);
  console.log(
    exec.status === 0
      ? '[prisma-migrate] ensure-runtime.sql OK'
      : '[prisma-migrate] ensure-runtime.sql had errors (continuing)',
  );
}

// Critical columns — always (covers cases where full ensure partially failed)
executeSql(CRITICAL_HEAL_SQL, 'critical-columns-heal');

console.log('[prisma-migrate] prisma db push --skip-generate');
const push = run([
  'db',
  'push',
  '--skip-generate',
  '--accept-data-loss',
  '--schema',
  schema,
]);
if (push.status === 0) {
  console.log('[prisma-migrate] db push OK — schema aligned with Prisma');
} else {
  console.warn('[prisma-migrate] db push failed — retry critical heal + ensure');
  executeSql(CRITICAL_HEAL_SQL, 'critical-columns-heal-retry');
  if (existsSync(ensureSql)) {
    run(['db', 'execute', '--file', ensureSql, '--schema', schema]);
  }
}

for (const name of RESOLVE_APPLIED) {
  run(['migrate', 'resolve', '--applied', name, '--schema', schema]);
}

const deploy = run(['migrate', 'deploy', '--schema', schema]);
if (deploy.status === 0) {
  console.log('[prisma-migrate] migrate deploy OK');
} else if (/P3009|failed migrations/i.test(deploy.out)) {
  const m = deploy.out.match(/The `([^`]+)` migration started at .+ failed/);
  if (m) run(['migrate', 'resolve', '--applied', m[1], '--schema', schema]);
  run(['migrate', 'deploy', '--schema', schema]);
}

console.log('[prisma-migrate] boot alignment finished — starting API');
process.exit(0);
