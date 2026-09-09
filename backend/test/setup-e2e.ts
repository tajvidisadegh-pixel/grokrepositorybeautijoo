const url = process.env.DATABASE_URL || '';
const nodeEnv = process.env.NODE_ENV || '';
const productionHints = [
  'beautijoo.ir',
  'liara.ir',
  'liara.run',
  'amazonaws.com',
  'neon.tech',
  'supabase.co',
  'railway.app',
  'render.com',
];

function fail(msg: string): never {
  console.error('\n[TEST SAFETY GUARD] ' + msg + '\n');
  process.exit(1);
}

if (nodeEnv !== 'test') {
  fail(`NODE_ENV must be "test" (got "${nodeEnv}")`);
}
if (!url) {
  fail('DATABASE_URL is required and must point to beautijoo_test');
}
if (!url.includes('beautijoo_test')) {
  fail(`DATABASE_URL must include "beautijoo_test"`);
}
for (const hint of productionHints) {
  if (url.toLowerCase().includes(hint)) {
    fail(`DATABASE_URL looks like production (contains "${hint}")`);
  }
}
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long!!';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long!';
}
process.env.SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3001';
// Do not start periodic cleanup timers during e2e
process.env.CLEANUP_ENABLED = process.env.CLEANUP_ENABLED || 'false';
