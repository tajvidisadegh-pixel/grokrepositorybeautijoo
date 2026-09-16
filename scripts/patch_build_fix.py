#!/usr/bin/env python3
from pathlib import Path

a = Path("backend/src/admin/admin.service.ts")
t = a.read_text()
start = t.find("  async uploadSiteCmsImage(")
if start < 0:
    print("uploadSiteCmsImage NOT FOUND")
else:
    clean = r'''  async uploadSiteCmsImage(
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
    )
      .replace(/\/$/, '')
      .replace(/\/api\/v1$/i, '');
    const url = publicBase
      ? `${publicBase}/api/v1/files/${key}`
      : `/api/v1/files/${key}`;
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', key, null, {
      url,
      slot: slot || 'generic',
      size: file.size,
    });
    return {
      url,
      key,
      slot: slot || 'generic',
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
'''
    fixed = t[:start] + clean
    a.write_text(fixed)
    print("admin.service.ts fixed", "braces", fixed.count("{"), fixed.count("}"))

ops = Path("backend/src/admin/admin-ops.controller.ts")
ot = ops.read_text()
if "await this.audit(actorId, 'professional.create'" in ot:
    ot = ot.replace(
        "await this.audit(actorId, 'professional.create', 'professional', pro.id, { phone, slug });",
        """try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'professional.create',
          entityType: 'professional',
          entityId: pro.id,
          before: null,
          after: { phone, slug } as any,
        },
      });
    } catch { /* non-blocking */ }""",
    )
    ops.write_text(ot)
    print("ops audit fixed")
else:
    print("ops audit already ok or missing")

print("DONE")
