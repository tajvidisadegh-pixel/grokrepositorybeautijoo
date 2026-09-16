#!/usr/bin/env python3
from pathlib import Path

m = Path("backend/src/media/media.service.ts")
t = m.read_text()
old = "      const pro = await this.prisma.professional.findUnique({ where: { userId } });\n      if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');\n\n      if (professionalServiceId) {"
new = """      let pro = await this.prisma.professional.findUnique({ where: { userId } });
      if (!pro) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
        if (!user) throw new NotFoundException('کاربر یافت نشد');
        const base = (user.profile?.displayName || user.phone || 'pro').toString().trim().toLowerCase().replace(/\\s+/g, '-').replace(/[^\\w\\u0600-\\u06FF-]+/g, '').slice(0, 40) || 'pro';
        let slug = base;
        for (let i = 0; i < 5; i++) {
          if (!(await this.prisma.professional.findUnique({ where: { slug } }))) break;
          slug = `${base}-${Date.now().toString(36).slice(-4)}`;
        }
        pro = await this.prisma.professional.create({
          data: { userId, slug, title: user.profile?.displayName || 'زیباگر', status: 'draft' as any },
        });
      }

      if (professionalServiceId) {"""
if old in t:
    m.write_text(t.replace(old, new, 1))
    print("media fixed")
else:
    print("media miss")

a = Path("backend/src/admin/admin.service.ts")
at = a.read_text()
at2 = at.replace(
    "const publicBase = (process.env.PUBLIC_FILES_BASE_URL || process.env.APP_URL || '').replace(/\\/$/, '');\n    const url = publicBase ? `${publicBase}/files/${key}` : `/files/${key}`;",
    "const publicBase = (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || process.env.APP_URL || '').replace(/\\/$/, '').replace(/\\/api\\/v1$/i, '');\n    const url = publicBase ? `${publicBase}/api/v1/files/${key}` : `/api/v1/files/${key}`;",
)
at2 = at2.replace(
    """    try {
      fs.mkdirSync(path.join(base, 'cms'), { recursive: true });
      fs.writeFileSync(path.join(base, key), buffer);
    } catch (e) {
      this.logger.warn(`CMS upload disk write failed: ${(e as Error)?.message || e}`);
    }""",
    """    try {
      fs.mkdirSync(path.dirname(path.join(base, key)), { recursive: true });
      fs.writeFileSync(path.join(base, key), buffer);
    } catch (e) {
      this.logger.warn(`CMS upload disk write failed: ${(e as Error)?.message || e}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود. دیسک ذخیره‌سازی را بررسی کنید.');
    }""",
)
old_pub = """  async publishSiteCms(actorId?: string) {
    const draft = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_draft' } });
    const value = (draft?.value as Prisma.InputJsonValue) ?? ({ version: 1, sections: [] } as Prisma.InputJsonValue);
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_published' },
      create: { key: 'site_cms_published', value },
      update: { value },
    });
    await this.audit(actorId, 'site_cms.publish', 'platform_setting', 'site_cms_published', null, value);
    return { success: true, publishedAt: new Date().toISOString() };
  }"""
new_pub = """  async publishSiteCms(actorId?: string) {
    const [contentRow, sectionsRow, legacyDraft] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_content' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_sections' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_draft' } }),
    ]);
    const content = (contentRow?.value as any) || {};
    const sections = Array.isArray(sectionsRow?.value)
      ? sectionsRow!.value
      : Array.isArray((sectionsRow?.value as any)?.sections)
        ? (sectionsRow!.value as any).sections
        : [];
    const legacy = (legacyDraft?.value as any) || {};
    const value = {
      version: 1,
      content: Object.keys(content).length ? content : (legacy.content || {}),
      hero: content.hero || legacy.hero || {},
      texts: content.texts || legacy.texts || {},
      features: content.features || legacy.features || {},
      sections: sections.length ? sections : (legacy.sections || []),
      publishedAt: new Date().toISOString(),
    } as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_published' },
      create: { key: 'site_cms_published', value },
      update: { value },
    });
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_draft' },
      create: { key: 'site_cms_draft', value },
      update: { value },
    });
    await this.audit(actorId, 'site_cms.publish', 'platform_setting', 'site_cms_published', null, value);
    return { success: true, publishedAt: value.publishedAt };
  }"""
if old_pub in at2:
    at2 = at2.replace(old_pub, new_pub)
    print("publish fixed")
else:
    print("publish miss")
a.write_text(at2)
print("admin written", "api/v1/files" in at2)

sb = Path("frontend/src/app/admin/site-builder/page.tsx")
st = sb.read_text()
old_fe = """  if (url.startsWith('/')) {
    try {
      const origin = new URL(API_URL).origin;
      url = `${origin}${url}`;
    } catch {
      /* keep relative */
    }
  }
  return url;"""
new_fe = """  if (url.startsWith('/')) {
    try {
      const origin = new URL(API_URL).origin;
      if (url.startsWith('/files/')) url = `${origin}/api/v1${url}`;
      else if (url.startsWith('/api/')) url = `${origin}${url}`;
      else url = `${origin}${url}`;
    } catch {
      /* keep relative */
    }
  }
  return url;"""
if old_fe in st:
    sb.write_text(st.replace(old_fe, new_fe))
    print("site-builder url fixed")
else:
    print("site-builder miss")
print("DONE")
