#!/usr/bin/env python3
"""#72 — زیباگر بدون لینک اجتماعی، بدون بلاک، بدون رد نوبت."""
from pathlib import Path


def patch_professionals_service() -> None:
    path = Path('backend/src/professionals/professionals.service.ts')
    t = path.read_text()

    # Block social URL updates from pro (keep internal keys like _pinnedServiceIds)
    old_social = '''    if (data.socialLinks !== undefined) {
      if (data.socialLinks === null) {
        proData.socialLinks = Prisma.JsonNull;
      } else {
        const allowed = ['instagram', 'telegram', 'website', 'phone', 'whatsapp'] as const;
'''
    if 'لینک اجتماعی از سمت زیباگر مجاز نیست' not in t and old_social in t:
        # Replace the whole socialLinks handling block more carefully
        start = t.find('    if (data.socialLinks !== undefined) {')
        if start >= 0:
            # find matching close - look for next top-level if after this block
            # Simpler: inject rejection at start of block
            t = t.replace(
                '    if (data.socialLinks !== undefined) {\n      if (data.socialLinks === null) {',
                "    if (data.socialLinks !== undefined) {\n"
                "      // #72 — public social URLs cannot be set by professional\n"
                "      const incoming = data.socialLinks as Record<string, unknown> | null;\n"
                "      if (incoming && typeof incoming === 'object') {\n"
                "        const publicKeys = ['instagram', 'telegram', 'website', 'phone', 'whatsapp'];\n"
                "        if (publicKeys.some((k) => k in incoming && incoming[k] != null && String(incoming[k]).trim() !== '')) {\n"
                "          throw new BadRequestException('ثبت لینک شبکه‌های اجتماعی در پروفایل زیباگر مجاز نیست');\n"
                "        }\n"
                "      }\n"
                "      if (data.socialLinks === null) {",
                1,
            )
            print('socialLinks guard added')

    # Disable block/unblock
    if 'بلاک کردن کاربر توسط زیباگر مجاز نیست' not in t:
        t = t.replace(
            '''  async blockCustomer(userId: string, customerId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    if (customerId === userId) throw new BadRequestException('نمی‌توانید خودتان را مسدود کنید');
''',
            '''  async blockCustomer(userId: string, customerId: string) {
    // #72 — professionals cannot block customers
    throw new BadRequestException('مسدود کردن کاربر توسط زیباگر مجاز نیست. در صورت مشکل از پشتیبانی تیکت ثبت کنید.');
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    if (customerId === userId) throw new BadRequestException('نمی‌توانید خودتان را مسدود کنید');
''',
            1,
        )
        t = t.replace(
            '''  async unblockCustomer(userId: string, customerId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
''',
            '''  async unblockCustomer(userId: string, customerId: string) {
    // #72
    throw new BadRequestException('رفع مسدودی از این مسیر در دسترس نیست');
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
''',
            1,
        )
        print('block APIs disabled')

    path.write_text(t)
    print('professionals.service', path.stat().st_size)


def patch_bookings_block_check() -> None:
    path = Path('backend/src/bookings/bookings.service.ts')
    t = path.read_text()
    # Disable blocked customer enforcement
    old = '''      const links = (proRow?.socialLinks as { _blockedCustomerIds?: string[] } | null) || null;
      const blocked = Array.isArray(links?._blockedCustomerIds) ? links!._blockedCustomerIds! : [];
      if (blocked.includes(customerId)) {
'''
    if 'issue #72' in t and '_blockedCustomerIds' in t and 'disabled' in t:
        print('block check already disabled')
        return
    if old in t:
        # Find the if block and neutralize
        t = t.replace(
            old,
            '''      // #72 — pro-initiated customer block no longer enforced
      const links = (proRow?.socialLinks as { _blockedCustomerIds?: string[] } | null) || null;
      const blocked = Array.isArray(links?._blockedCustomerIds) ? links!._blockedCustomerIds! : [];
      if (false && blocked.includes(customerId)) {
''',
            1,
        )
        path.write_text(t)
        print('booking block check disabled')
    else:
        print('WARN: blocked check pattern not found')


def patch_pro_bookings_ui() -> None:
    path = Path('frontend/src/app/zibagar/bookings/page.tsx')
    t = path.read_text()
    # Remove blockCustomer function body usage - remove button
    import re

    # Remove block button JSX
    t2 = re.sub(
        r"\s*<Button[^>]*>\s*مسدود کردن مشتری\s*</Button>",
        '',
        t,
        count=5,
    )
    # Also multiline button with onClick blockCustomer
    lines = t2.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        window = ''.join(lines[i : i + 10])
        if 'blockCustomer' in window and '<Button' in window:
            # skip until </Button>
            while i < len(lines) and '</Button>' not in lines[i]:
                i += 1
            i += 1
            continue
        out.append(lines[i])
        i += 1
    t2 = ''.join(out)

    # Neutralize async function blockCustomer to avoid dead code issues
    if 'async function blockCustomer' in t2:
        t2 = t2.replace(
            'async function blockCustomer',
            'async function blockCustomerDisabled',
            1,
        )

    path.write_text(t2)
    print('pro bookings block UI removed', path.stat().st_size)


def patch_pro_profile_social() -> None:
    path = Path('frontend/src/app/zibagar/profile/page.tsx')
    t = path.read_text()
    # Soft: disable saveSocialLinks
    if 'async function saveSocialLinks' in t and '#72' not in t[t.find('saveSocialLinks'):t.find('saveSocialLinks')+200]:
        t = t.replace(
            'async function saveSocialLinks() {',
            'async function saveSocialLinks() {\n'
            "    // #72 — social links disabled for professionals\n"
            "    setSocialMsg('ثبت لینک شبکه‌های اجتماعی مجاز نیست');\n"
            '    return;\n',
            1,
        )
        path.write_text(t)
        print('profile saveSocialLinks disabled')
    else:
        print('profile social skip')


if __name__ == '__main__':
    patch_professionals_service()
    patch_bookings_block_check()
    patch_pro_bookings_ui()
    patch_pro_profile_social()
