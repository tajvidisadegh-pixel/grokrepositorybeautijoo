#!/usr/bin/env python3
"""H1 upload sniff, local storage MIME, deleteMedia storage, platform whitelist, path safety."""
from pathlib import Path

# ---------------------------------------------------------------------------
# admin.service.ts — uploadSiteCmsImage security + deleteMedia storage
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

# imports for sniff/security if missing
if "assertNotSuspicious" not in st:
    st = st.replace(
        "import { userAuthCache } from '../auth/user-auth-cache';",
        "import { userAuthCache } from '../auth/user-auth-cache';\n"
        "import { assertNotSuspicious, assertUploadSize } from '../media/upload-security';\n"
        "import { sniffImage } from '../media/image-sniff';",
        1,
    )
    print("imports added")

old_up = """  async uploadSiteCmsImage(
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
    const safeName = (file.originalname || 'img').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const ext = (safeName.split('.').pop() || 'jpg').toLowerCase();
    const key = `cms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const mime = file.mimetype || 'application/octet-stream';
    let storageKey: string;
    try {
      storageKey = await this.storage.upload(key, buffer, mime);
    } catch (e) {
      this.logger.warn(`CMS upload via storage provider failed: ${(e as Error)?.message || e}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود. تنظیمات ذخیره‌سازی را بررسی کنید.');
    }
    const url = this.storage.getPublicUrl(storageKey);
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', storageKey, null, {
      url,
      slot: slot || 'generic',
      size: file.size,
    });
    return {
      url,
      key: storageKey,
      slot: slot || 'generic',
      mimeType: mime,
      size: file.size,
    };
  }"""

new_up = """  async uploadSiteCmsImage(
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
      // Cap read to 12MB to avoid memory blow (#r4.M5)
      const st = fs.statSync(file.path);
      if (st.size > 12 * 1024 * 1024) throw new BadRequestException('حجم فایل بیش از حد مجاز است');
      buffer = fs.readFileSync(file.path);
    } else {
      throw new BadRequestException('فایل خالی است');
    }
    assertUploadSize(buffer.length, file.mimetype);
    assertNotSuspicious(buffer, file.mimetype);
    const sniffed = sniffImage(buffer);
    if (!sniffed || sniffed.kind === 'heic') {
      throw new BadRequestException('فقط تصویر JPEG/PNG/WebP/GIF مجاز است');
    }
    const key = `cms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${sniffed.ext}`;
    const mime = sniffed.mime;
    let storageKey: string;
    try {
      storageKey = await this.storage.upload(key, buffer, mime);
    } catch (e) {
      this.logger.warn(`CMS upload via storage provider failed: ${(e as Error)?.message || e}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود. تنظیمات ذخیره‌سازی را بررسی کنید.');
    }
    const url = this.storage.getPublicUrl(storageKey);
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', storageKey, null, {
      url,
      slot: slot || 'generic',
      size: buffer.length,
      mime,
    });
    return {
      url,
      key: storageKey,
      slot: slot || 'generic',
      mimeType: mime,
      size: buffer.length,
    };
  }"""

if old_up in st:
    st = st.replace(old_up, new_up, 1)
    print("H1 uploadSiteCmsImage secured")
else:
    print("H1 pattern miss")

# deleteMedia also remove from storage
old_dm = """  async deleteMedia(id: string, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit(actorId, 'media.delete', 'media_asset', id, existing, null);
    return { success: true, id };
  }"""
new_dm = """  async deleteMedia(id: string, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
    const storageKey = (existing as any).storageKey || (existing as any).key || (existing as any).path;
    if (storageKey && this.storage.delete) {
      try {
        await this.storage.delete(String(storageKey));
      } catch (e) {
        this.logger.warn(`storage delete failed key=${storageKey}: ${(e as Error)?.message || e}`);
      }
    }
    await this.audit(actorId, 'media.delete', 'media_asset', id, existing, null);
    return { success: true, id };
  }"""
if old_dm in st:
    st = st.replace(old_dm, new_dm, 1)
    print("M4 deleteMedia storage")
else:
    print("M4 pattern miss")

# H2 platform settings whitelist on updatePlatformSettings
# Inject after deepMerge line
if "ALLOWED_PLATFORM_ROOT_KEYS" not in st:
    # add constant before class
    st = st.replace(
        "@Injectable()\nexport class AdminService {",
        "/** Whitelist root keys for platform_config (#r4.H2). */\n"
        "const ALLOWED_PLATFORM_ROOT_KEYS = new Set([\n"
        "  'booking', 'commission', 'professionals', 'reviews', 'search', 'auth', 'privacy',\n"
        "]);\n\n@Injectable()\nexport class AdminService {",
        1,
    )
    old_merge = "    const current = await this.getPlatformSettings();\n    const next = this.deepMerge(current as Record<string, unknown>, partial || {});"
    new_merge = """    const current = await this.getPlatformSettings();
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(partial || {})) {
      if (ALLOWED_PLATFORM_ROOT_KEYS.has(k)) cleaned[k] = v;
    }
    const next = this.deepMerge(current as Record<string, unknown>, cleaned);"""
    if old_merge in st:
        st = st.replace(old_merge, new_merge, 1)
        print("H2 platform whitelist")
    else:
        print("H2 merge pattern miss")

svc.write_text(st, encoding="utf-8")
print("admin.service done")

# ---------------------------------------------------------------------------
# local-storage.provider.ts — path sep + MIME
# ---------------------------------------------------------------------------
lp = Path("backend/src/storage/local-storage.provider.ts")
lt = lp.read_text(encoding="utf-8")

# safer startsWith with path.sep
lt = lt.replace(
    "if (!full.startsWith(this.basePath)) {",
    "const baseWithSep = this.basePath.endsWith(path.sep) ? this.basePath : this.basePath + path.sep;\n    if (full !== this.basePath && !full.startsWith(baseWithSep)) {",
)
# download path check similarly - only first occurrence of download's startsWith
# Fix content-type default
old_ct = """      const contentType = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : lower.endsWith('.mp4')
              ? 'video/mp4'
              : 'image/jpeg';"""
new_ct = """      const contentType = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : lower.endsWith('.mp4')
              ? 'video/mp4'
              : lower.endsWith('.webm')
                ? 'video/webm'
                : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
                  ? 'image/jpeg'
                  : 'application/octet-stream';"""
if old_ct in lt:
    lt = lt.replace(old_ct, new_ct, 1)
    print("M6 content-type")

lp.write_text(lt, encoding="utf-8")
print("local storage done")

print("DONE")
