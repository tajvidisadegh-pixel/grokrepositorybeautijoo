/**
 * Boot-time DB alignment:
 * 1) SQL ensure (idempotent ALTERs for known drifts)
 * 2) prisma db push (authoritative sync to schema.prisma)
 * 3) migrate deploy best-effort (history cleanup)
 * Never block API start if schema was healed.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const RESOLVE_ROLLED_BACK = ['20260909093000_account_type_separation'];
const RESOLVE_APPLIED = [
  '20260911090000_ensure_production_schema',
  '20260911120000_align_missing_columns',
  '20260911140000_full_schema_align',
  '20260911150000_media_assets_url',
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
  console.warn('[prisma-migrate] db push failed — SQL ensure may still be enough');
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
