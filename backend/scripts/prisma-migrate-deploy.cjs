/**
 * Production-safe migrate deploy:
 * 1) Resolve known failed phantom migration (P3009)
 * 2) Apply idempotent ensure-schema SQL (heals partial columns)
 * 3) prisma migrate deploy
 */
const { existsSync, readFileSync } = require('fs');
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

const prismaRoot = join(schema, '..'); // .../prisma
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

for (const name of KNOWN_FAILED) {
  console.warn(`[prisma-migrate] resolve --rolled-back ${name}`);
  const resolved = run([
    'migrate',
    'resolve',
    '--rolled-back',
    name,
    '--schema',
    schema,
  ]);
  if (resolved.status !== 0) {
    console.warn(
      `[prisma-migrate] resolve exited ${resolved.status} (ok if already clean)`,
    );
  }
}

// Pre-heal: run ensure SQL if file present (also applied via migration folder)
const ensureSql = join(
  prismaRoot,
  'migrations',
  '20260911090000_ensure_production_schema',
  'migration.sql',
);
if (existsSync(ensureSql)) {
  console.log('[prisma-migrate] applying ensure-schema SQL via db execute…');
  const exec = run([
    'db',
    'execute',
    '--file',
    ensureSql,
    '--schema',
    schema,
  ]);
  if (exec.status !== 0) {
    console.warn(
      '[prisma-migrate] db execute ensure-schema exited non-zero — continuing to migrate deploy',
    );
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
  const name = (m && m[1]) || KNOWN_FAILED[0];
  console.warn(`[prisma-migrate] still blocked; resolve ${name}`);
  run(['migrate', 'resolve', '--rolled-back', name, '--schema', schema]);
  result = run(['migrate', 'deploy', '--schema', schema]);
  if (result.status === 0) {
    console.log('[prisma-migrate] OK after second resolve');
    process.exit(0);
  }
}

console.error('[prisma-migrate] deploy failed — refusing to start the API');
process.exit(result.status || 1);
