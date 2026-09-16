#!/usr/bin/env python3
from pathlib import Path

def replace_method(src, name, new_body):
    key = f"async {name}("
    start = src.find(key)
    if start < 0:
        print(name, "NOT FOUND")
        return src
    i = src.find("{", start)
    depth = 0
    j = i
    while j < len(src):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                j += 1
                break
        j += 1
    return src[:start] + new_body + src[j:]

# Media roles
ctrl = Path("backend/src/media/media.controller.ts")
ct = ctrl.read_text()
ct2 = ct.replace(
    "@Roles('professional', 'admin')",
    "@Roles('professional', 'admin', 'SUPER_ADMIN')",
)
if ct2 != ct:
    ctrl.write_text(ct2)
    print("media roles expanded")

# Auto-create professional on upload
media = Path("backend/src/media/media.service.ts")
mt = media.read_text()
old_pro_check = """      const pro = await this.prisma.professional.findUnique({ where: { userId } });
      if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');"""
new_pro_check = """      let pro = await this.prisma.professional.findUnique({ where: { userId } });
      if (!pro) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        });
        if (!user) throw new NotFoundException('کاربر یافت نشد');
        const baseSlug = (user.profile?.displayName || user.phone || 'pro')
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\\s+/g, '-')
          .replace(/[^\\w\\u0600-\\u06FF-]+/g, '')
          .slice(0, 40) || 'pro';
        let slug = baseSlug;
        for (let i = 0; i < 5; i++) {
          const taken = await this.prisma.professional.findUnique({ where: { slug } });
          if (!taken) break;
          slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
        }
        pro = await this.prisma.professional.create({
          data: {
            userId,
            slug,
            title: user.profile?.displayName || 'زیباگر',
            status: 'draft' as any,
          },
        });
      }"""
if old_pro_check in mt:
    media.write_text(mt.replace(old_pro_check, new_pro_check))
    print("media auto-create pro fixed")
else:
    print("media pro check pattern miss")

# CMS upload + publish
admin = Path("backend/src/admin/admin.service.ts")
at = admin.read_text()

NEW_UPLOAD = """async uploadSiteCmsImage(
    file: {
      buffer?: Buffer;
      path?: string;
      mimetype: string;
      originalname: string;
      size: number;
    },
    slot?: string,
    actorId?: string,
  ) {
    if (!file) throw new BadRequestException('فایل ارسال نشده است');
    let buffer: Buffer;
    if (file.buffer?.length) {
      buffer = file.buffer;
    } else if (file.path) {
      buffer = fs.readFileSync(file.path);
    } else {
      throw new BadRequestException('فایل خالی است');
    }
    const safeName = (file.originalname || 'img').replace(/[^\\w.\\-]+/g, '_').slice(0, 80);
    const ext = (safeName.split('.').pop() || 'jpg').toLowerCase();
    const key = `cms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const base = process.env.STORAGE_LOCAL_PATH
      ? (process.env.STORAGE_LOCAL_PATH.startsWith('/')
          ? process.env.STORAGE_LOCAL_PATH
          : path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH))
      : path.join(process.cwd(), 'uploads');
    try {
      fs.mkdirSync(path.dirname(path.join(base, key)), { recursive: true });
      fs.writeFileSync(path.join(base, key), buffer);
    } catch (e) {
      this.logger.warn(`CMS upload disk write failed: ${(e as Error)?.message || e}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود. دیسک ذخیره‌سازی را بررسی کنید.');
    }
    const publicBase = (
      process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      process.env.APP_URL ||
      ''
    ).replace(/\\/$/, '').replace(/\\/api\\/v1$/i, '');
    const url = publicBase
      ? `${publicBase}/api/v1/files/${key}`
      : `/api/v1/files/${key}`;
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', key, null, { url, slot, size: file.size });
    return { url, key, slot: slot || 'generic', mimeType: file.mimetype };
  }"""

NEW_PUBLISH = """async publishSiteCms(actorId?: string) {
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

at2 = replace_method(at, "uploadSiteCmsImage", NEW_UPLOAD)
at2 = replace_method(at2, "publishSiteCms", NEW_PUBLISH)
admin.write_text(at2)
print("cms upload+publish fixed")

# AdminOps create professional
ops = Path("backend/src/admin/admin-ops.controller.ts")
if ops.exists():
    ot = ops.read_text()
    if "professionals/create" not in ot:
        extra = '''
  @Post('professionals/create')
  async createProfessional(
    @Body() body: { phone: string; title?: string; displayName?: string; firstName?: string; lastName?: string },
    @CurrentUser('id') actorId?: string,
  ) {
    const phone = String(body.phone || '').trim();
    if (!phone) throw new BadRequestException('موبایل الزامی است');
    let user: any = await this.prisma.user.findFirst({ where: { phone }, include: { professional: true, profile: true } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          accountType: 'professional' as any,
          status: 'active' as any,
          profile: {
            create: {
              displayName: (body.displayName || body.title || body.firstName || phone).trim(),
              firstName: body.firstName?.trim() || null,
              lastName: body.lastName?.trim() || null,
            },
          },
        },
        include: { professional: true, profile: true },
      });
    }
    if (user.professional) return user.professional;
    const baseSlug = (body.title || body.displayName || phone).toString().trim().toLowerCase().replace(/\\s+/g, '-').replace(/[^\\w\\u0600-\\u06FF-]+/g, '').slice(0, 40) || 'pro';
    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const taken = await this.prisma.professional.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    }
    const pro = await this.prisma.professional.create({
      data: { userId: user.id, slug, title: (body.title || body.displayName || 'زیباگر').trim(), status: 'draft' as any },
    });
    await this.audit(actorId, 'professional.create', 'professional', pro.id, { phone, slug });
    return pro;
  }
'''
        idx = ot.rfind("}")
        ops.write_text(ot[:idx] + extra + "\n}\n")
        print("admin create professional added")
    else:
        print("admin create pro already exists")
else:
    print("admin-ops missing")

# Site builder resolve URL
sb = Path("frontend/src/app/admin/site-builder/page.tsx")
if sb.exists():
    st = sb.read_text()
    if "function resolveCmsUrl" not in st:
        helper = '''
function resolveCmsUrl(url?: string | null): string {
  if (!url) return '';
  const u = String(url).trim();
  if (!u) return '';
  if (/^https?:\\/\\//i.test(u)) return u;
  const api = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\\/$/, '');
  const origin = api.replace(/\\/api\\/v1$/i, '');
  if (u.startsWith('/api/v1/')) return `${origin}${u}`;
  if (u.startsWith('/files/')) return `${origin}/api/v1${u}`;
  if (u.startsWith('/')) return `${origin}${u}`;
  return `${api}/files/${u.replace(/^\\/+/, '')}`;
}
'''
        st = st.replace("async function uploadCmsImage", helper + "\nasync function uploadCmsImage")
        if "return String(data.url || data.publicUrl || '');" in st:
            st = st.replace(
                "return String(data.url || data.publicUrl || '');",
                "return resolveCmsUrl(String(data.url || data.publicUrl || ''));",
            )
        sb.write_text(st)
        print("site-builder resolveCmsUrl added")
    else:
        print("site-builder already has resolve")

print("ALL DONE")
