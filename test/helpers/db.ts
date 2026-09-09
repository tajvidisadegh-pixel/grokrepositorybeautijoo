import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const backendRoot = path.resolve(__dirname, '../..');

export function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('beautijoo_test')) {
    throw new Error('Refusing DB operation: DATABASE_URL is not beautijoo_test');
  }
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing DB operation: NODE_ENV is not test');
  }
}

export function migrateTestDb(): void {
  assertTestDatabase();
  // Fresh test DBs: db push avoids broken/duplicate migration history on empty Postgres.
  execSync('npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss', {
    cwd: backendRoot,
    env: { ...process.env },
    stdio: 'inherit',
  });
}

export function seedRoles(): void {
  assertTestDatabase();
  execSync('node prisma/seed-roles.cjs', {
    cwd: backendRoot,
    env: { ...process.env },
    stdio: 'inherit',
  });
}

export async function cleanupUserData(prisma: PrismaClient): Promise<void> {
  assertTestDatabase();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "booking_items",
      "payments",
      "bookings",
      "manual_reservations",
      "time_offs",
      "working_hour_breaks",
      "working_hours",
      "professional_services",
      "professional_locations",
      "reviews",
      "favorites",
      "notifications",
      "audit_logs",
      "refresh_tokens",
      "sessions",
      "otp_codes",
      "professionals",
      "user_roles",
      "profiles",
      "users"
    CASCADE;
  `);
}

export function createPrisma(): PrismaClient {
  assertTestDatabase();
  return new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
}
