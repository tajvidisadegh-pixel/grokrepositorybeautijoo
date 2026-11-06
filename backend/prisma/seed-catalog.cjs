/**
 * Professional catalog seed — root categories + sample hierarchy branches.
 * Create-only upsert: never clobber admin name/isActive/parent changes (#26).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** 19 root categories — hard-coded seed only; structure remains dynamic */
const ROOT_CATEGORIES = [
  { name: 'مو', slug: 'hair', sortOrder: 1 },
  { name: 'رنگ و لایت', slug: 'color-light', sortOrder: 2 },
  { name: 'ناخن', slug: 'nails', sortOrder: 3 },
  { name: 'پوست', slug: 'skin', sortOrder: 4 },
  { name: 'ابرو و مژه', slug: 'brow-lash', sortOrder: 5 },
  { name: 'آرایش', slug: 'makeup', sortOrder: 6 },
  { name: 'ماساژ', slug: 'massage', sortOrder: 7 },
  { name: 'اپیلاسیون', slug: 'epilation', sortOrder: 8 },
  { name: 'لیزر', slug: 'laser', sortOrder: 9 },
  { name: 'بدن', slug: 'body', sortOrder: 10 },
  { name: 'مردانه', slug: 'mens', sortOrder: 11 },
  { name: 'عروس', slug: 'bridal', sortOrder: 12 },
  { name: 'کودک', slug: 'kids', sortOrder: 13 },
  { name: 'اسپا', slug: 'spa', sortOrder: 14 },
  { name: 'تاتو', slug: 'tattoo', sortOrder: 15 },
  { name: 'میکرو', slug: 'micro', sortOrder: 16 },
  { name: 'سایر', slug: 'other', sortOrder: 17 },
];

const SAMPLE_BRANCHES = [
  {
    name: 'کاشت ناخن',
    slug: 'nail-extension',
    sortOrder: 1,
    parentSlug: 'nails',
    children: [
      { name: 'کاشت ژل', slug: 'gel-extension', sortOrder: 1 },
      { name: 'کاشت پودر', slug: 'acrylic-extension', sortOrder: 2 },
    ],
  },
];

/** Create-only upsert: never clobber admin name/isActive/parent changes (#26). */
async function ensureCategory({ name, slug, sortOrder, parentId }) {
  const existing = await prisma.serviceCategory.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.serviceCategory.create({
    data: {
      name,
      slug,
      sortOrder: sortOrder ?? 0,
      parentId: parentId || null,
      isActive: true,
    },
  });
}

async function seedSampleBranch(node, parentId) {
  const cat = await ensureCategory({
    name: node.name,
    slug: node.slug,
    sortOrder: node.sortOrder,
    parentId,
  });
  let count = 0;
  for (const child of node.children || []) {
    count += await seedSampleBranch(child, cat.id);
  }
  if (!node.children || !node.children.length) {
    const svcSlug = `${node.slug}-svc`;
    const existing = await prisma.service.findUnique({ where: { slug: svcSlug } });
    if (!existing) {
      await prisma.service.create({
        data: {
          name: node.name,
          slug: svcSlug,
          categoryId: cat.id,
          isActive: true,
          sortOrder: 0,
        },
      });
      count += 1;
    }
  }
  return count;
}

async function seedColorTechniques() {
  const parent = await prisma.serviceCategory.findUnique({ where: { slug: 'color-light' } });
  if (!parent) {
    console.warn('color-light category missing — skip color techniques');
    return 0;
  }
  const techniques = [
    { name: 'بالیاژ', slug: 'balayage', sortOrder: 1 },
    { name: 'سامبره', slug: 'ombre', sortOrder: 2 },
    { name: 'هایلایت', slug: 'highlight', sortOrder: 3 },
    { name: 'لایت ریشه', slug: 'root-light', sortOrder: 4 },
    { name: 'دکلره', slug: 'bleach', sortOrder: 5 },
  ];
  let n = 0;
  for (const tech of techniques) {
    await ensureCategory({
      name: tech.name,
      slug: tech.slug,
      sortOrder: tech.sortOrder,
      parentId: parent.id,
    });
    n++;
  }
  return n;
}

async function main() {
  await seedColorTechniques();
  for (const root of ROOT_CATEGORIES) {
    await ensureCategory({
      name: root.name,
      slug: root.slug,
      sortOrder: root.sortOrder,
      parentId: null,
    });
  }

  let serviceCount = 0;
  for (const branch of SAMPLE_BRANCHES) {
    const parent = await prisma.serviceCategory.findUnique({
      where: { slug: branch.parentSlug },
    });
    if (!parent) {
      console.warn(`Parent category ${branch.parentSlug} not found, skip sample`);
      continue;
    }
    serviceCount += await seedSampleBranch(branch, parent.id);
  }

  console.log(
    `Catalog seed OK — ${ROOT_CATEGORIES.length} root categories ensured (no overwrite), ${serviceCount} sample services ensured`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
