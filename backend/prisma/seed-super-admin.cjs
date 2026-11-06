/**
 * Assign SUPER_ADMIN to a real user from environment variables.
 * Never hardcode phone/password in the repo.
 *
 * Usage (from backend/):
 *   SUPER_ADMIN_PHONE=0912xxxxxxx SUPER_ADMIN_PASSWORD='your-strong-pass' node prisma/seed-super-admin.cjs
 */
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

function normalizePhone(phone) {
  return String(phone || '').trim().replace(/\s+/g, '');
}

async function main() {
  const phone = normalizePhone(process.env.SUPER_ADMIN_PHONE);
  const password = process.env.SUPER_ADMIN_PASSWORD || '';
  const displayName = (process.env.SUPER_ADMIN_DISPLAY_NAME || 'سوپر ادمین').trim();

  if (!phone || phone.length < 10) {
    throw new Error('SUPER_ADMIN_PHONE is required (e.g. 0912xxxxxxx)');
  }
  if (!password || password.length < 8) {
    throw new Error('SUPER_ADMIN_PASSWORD is required (min 8 characters)');
  }

  const role = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      displayName: 'سوپر ادمین',
      isSystem: true,
      description: 'نقش سیستمی سطح بالای پلتفرم',
    },
    create: {
      name: 'SUPER_ADMIN',
      displayName: 'سوپر ادمین',
      isSystem: true,
      description: 'نقش سیستمی سطح بالای پلتفرم',
    },
  });

  // Ensure customer role exists (login gates historically required it)
  const customerRole = await prisma.role.upsert({
    where: { name: 'customer' },
    update: {},
    create: {
      name: 'customer',
      displayName: 'مشتری',
      isSystem: true,
    },
  });

  const passwordHash = await argon2.hash(password);

  let user = await prisma.user.findFirst({
    where: { phone, accountType: 'customer' },
    include: { profile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        accountType: 'customer',
        status: 'active',
        phoneVerified: true,
        profile: { create: { displayName } },
      },
      include: { profile: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'active',
        phoneVerified: true,
        accountType: 'customer',
      },
      include: { profile: true },
    });
  }

  if (user.profile) {
    await prisma.profile.update({
      where: { userId: user.id },
      data: { displayName },
    });
  } else {
    await prisma.profile.create({
      data: { userId: user.id, displayName },
    });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  // Optional: also attach customer so old clients that gate on customer role still work
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: customerRole.id } },
    update: {},
    create: { userId: user.id, roleId: customerRole.id },
  });

  console.log('SUPER_ADMIN ready for phone:', phone);
  console.log('user id:', user.id);
  console.log('Login at /login (as مشتری) then open /admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
