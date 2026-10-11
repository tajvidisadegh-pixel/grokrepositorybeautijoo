/** Production-safe system roles + admin channel permissions (issue #37). */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** @type {{ code: string, displayName: string }[]} */
const PERMISSIONS = [
  { code: 'admin.dashboard.read', displayName: '\u062f\u0627\u0634\u0628\u0648\u0631\u062f \u0627\u062f\u0645\u06cc\u0646' },
  { code: 'admin.users.read', displayName: '\u0645\u0634\u0627\u0647\u062f\u0647 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646' },
  { code: 'admin.users.write', displayName: '\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646' },
  { code: 'admin.professionals.read', displayName: '\u0645\u0634\u0627\u0647\u062f\u0647 \u0632\u06cc\u0628\u0627\u06af\u0631\u0627\u0646' },
  { code: 'admin.professionals.write', displayName: '\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0632\u06cc\u0628\u0627\u06af\u0631\u0627\u0646' },
  { code: 'admin.bookings.read', displayName: '\u0645\u0634\u0627\u0647\u062f\u0647 \u0631\u0632\u0631\u0648\u0647\u0627' },
  { code: 'admin.bookings.write', displayName: '\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0631\u0632\u0631\u0648\u0647\u0627' },
  { code: 'admin.reviews.moderate', displayName: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u0646\u0638\u0631\u0627\u062a' },
  { code: 'admin.media.moderate', displayName: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u0631\u0633\u0627\u0646\u0647\u200c\u0647\u0627' },
  { code: 'admin.finance.read', displayName: '\u0645\u0634\u0627\u0647\u062f\u0647 \u0645\u0627\u0644\u06cc' },
  { code: 'admin.finance.write', displayName: '\u0648\u06cc\u0631\u0627\u06cc\u0634 \u0645\u0627\u0644\u06cc' },
  { code: 'admin.notifications.send', displayName: '\u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646' },
  { code: 'admin.catalog.manage', displayName: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u06a9\u0627\u062a\u0627\u0644\u0648\u06af' },
  { code: 'admin.settings.read', displayName: '\u0645\u0634\u0627\u0647\u062f\u0647 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a' },
  { code: 'admin.settings.write', displayName: '\u0648\u06cc\u0631\u0627\u06cc\u0634 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a' },
  { code: 'admin.site_builder.manage', displayName: '\u0637\u0631\u0627\u062d\u06cc \u0633\u0627\u06cc\u062a' },
  { code: 'admin.support.handle', displayName: '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc' },
  { code: 'admin.audit.read', displayName: '\u0644\u0627\u06af \u0641\u0639\u0627\u0644\u06cc\u062a\u200c\u0647\u0627' },
];

/** Channel roles \u2192 permission codes (issue #37) */
const CHANNEL_ROLES = [
  {
    name: 'admin_customers',
    displayName: '\u0627\u062f\u0645\u06cc\u0646 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646',
    description: 'Issue #37 \u2014 only customers/users section',
    perms: ['admin.dashboard.read', 'admin.users.read', 'admin.users.write'],
  },
  {
    name: 'admin_professionals',
    displayName: '\u0627\u062f\u0645\u06cc\u0646 \u0632\u06cc\u0628\u0627\u06af\u0631\u0627\u0646',
    description: 'Issue #37 \u2014 only professionals section',
    perms: ['admin.dashboard.read', 'admin.professionals.read', 'admin.professionals.write', 'admin.media.moderate'],
  },
  {
    name: 'admin_bookings',
    displayName: '\u0627\u062f\u0645\u06cc\u0646 \u0631\u0632\u0631\u0648\u0647\u0627',
    description: 'Issue #37 \u2014 only bookings section',
    perms: ['admin.dashboard.read', 'admin.bookings.read', 'admin.bookings.write'],
  },
  {
    name: 'admin_finance',
    displayName: '\u0627\u062f\u0645\u06cc\u0646 \u0645\u0627\u0644\u06cc',
    description: 'Issue #37 \u2014 only finance section',
    perms: ['admin.dashboard.read', 'admin.finance.read', 'admin.finance.write'],
  },
  {
    name: 'admin_content',
    displayName: '\u0627\u062f\u0645\u06cc\u0646 \u0645\u062d\u062a\u0648\u0627',
    description: 'Issue #37 \u2014 reviews, media, catalog',
    perms: [
      'admin.dashboard.read',
      'admin.reviews.moderate',
      'admin.media.moderate',
      'admin.catalog.manage',
    ],
  },
  {
    name: 'admin_support',
    displayName: '\u0627\u062f\u0645\u06cc\u0646 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc',
    description: 'Issue #37 \u2014 support + notifications',
    perms: ['admin.dashboard.read', 'admin.support.handle', 'admin.notifications.send'],
  },
];

const BASE_ROLES = [
  { name: 'customer', displayName: '\u0645\u0634\u062a\u0631\u06cc', isSystem: true },
  { name: 'professional', displayName: '\u0632\u06cc\u0628\u0627\u06af\u0631', isSystem: true },
  { name: 'staff', displayName: '\u06a9\u0627\u0631\u0645\u0646\u062f', isSystem: true },
  { name: 'admin', displayName: '\u0645\u062f\u06cc\u0631', isSystem: true },
  {
    name: 'SUPER_ADMIN',
    displayName: '\u0633\u0648\u067e\u0631 \u0627\u062f\u0645\u06cc\u0646',
    description: '\u0646\u0642\u0634 \u0633\u06cc\u0633\u062a\u0645\u06cc \u0633\u0637\u062d \u0628\u0627\u0644\u0627\u06cc \u067e\u0644\u062a\u0641\u0631\u0645',
    isSystem: true,
  },
];

async function main() {
  for (const r of BASE_ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {
        displayName: r.displayName,
        isSystem: r.isSystem,
        ...(r.description !== undefined ? { description: r.description } : {}),
      },
      create: r,
    });
    console.log('role:', r.name);
  }

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { displayName: p.displayName },
      create: p,
    });
    console.log('perm:', p.code);
  }

  const allPerms = await prisma.permission.findMany({
    where: { code: { in: PERMISSIONS.map((p) => p.code) } },
  });
  const byCode = Object.fromEntries(allPerms.map((p) => [p.code, p]));

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  for (const ch of CHANNEL_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: ch.name },
      update: {
        displayName: ch.displayName,
        description: ch.description,
        isSystem: true,
      },
      create: {
        name: ch.name,
        displayName: ch.displayName,
        description: ch.description,
        isSystem: true,
      },
    });
    for (const code of ch.perms) {
      const perm = byCode[code];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log('channel role:', ch.name, 'perms:', ch.perms.length);
  }

  console.log('Issue #37 roles + permissions ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
