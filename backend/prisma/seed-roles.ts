/**
 * Production-safe: upsert system roles only (no test users).
 * After: npx prisma migrate deploy
 * Run:  npm run prisma:seed-roles
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { name: 'customer', displayName: 'مشتری', isSystem: true },
    { name: 'professional', displayName: 'زیباگر', isSystem: true },
    { name: 'staff', displayName: 'کارمند', isSystem: true },
    { name: 'admin', displayName: 'مدیر', isSystem: true },
    {
      name: 'SUPER_ADMIN',
      displayName: 'سوپر ادمین',
      description: 'نقش سیستمی سطح بالای پلتفرم؛ بدون انتساب خودکار به کاربر',
      isSystem: true,
    },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {
        displayName: r.displayName,
        isSystem: r.isSystem,
        ...(r.description !== undefined ? { description: r.description } : {}),
      },
      create: r,
    });
    console.log(`role upserted: ${r.name}`);
  }
  console.log('✅ System roles ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
