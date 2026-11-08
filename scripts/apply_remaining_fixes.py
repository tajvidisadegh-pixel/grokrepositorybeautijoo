#!/usr/bin/env python3
"""Apply remaining production-hardening fixes on top of a known-good bookings.service."""
from pathlib import Path
import subprocess

def main():
    raw = subprocess.check_output([
        'git', 'show',
        '2b44ecd8075297c7fb81736921bbefa8558db5ef:backend/src/bookings/bookings.service.ts',
    ])
    t = raw.decode('utf-8')
    assert 'BookingsService' in t and len(t) > 10000
    t = t.replace('this.downstreamprisma', 'this.prisma')
    t = t.replace('take: 20,\n', '', 1)
    t = t.replace(
        'if (query.from) (where.startAt as any).gte = new Date(query.from);',
        'if (query.from) { const from = new Date(query.from); if (isNaN(from.getTime())) throw new BadRequestException("invalid from"); (where.startAt as any).gte = from; }',
        1,
    )
    t = t.replace(
        'if (query.to) (where.startAt as any).lte = new Date(query.to);',
        'if (query.to) { const to = new Date(query.to); if (isNaN(to.getTime())) throw new BadRequestException("invalid to"); (where.startAt as any).lte = to; }',
        1,
    )
    if 'offline auto-confirm' not in t:
        idx = t.find('post-create notify failed')
        r = t.find('return booking;', idx if idx >= 0 else 0)
        if r > 0:
            inj = (
                "\n      try {\n"
                "        const payMode = (process.env.BOOKING_PAYMENT_MODE || 'auto').toString().trim().toLowerCase();\n"
                "        const provider = (process.env.PAYMENT_PROVIDER || '').toString().trim().toLowerCase();\n"
                "        const offline = payMode === 'offline' || payMode === 'no_gateway' || payMode === 'pay_later' "
                "|| (payMode === 'auto' && (!provider || provider === 'disabled' || provider === 'none'));\n"
                "        if (offline) {\n"
                "          await this.payments.initiate(customerId, booking.id, 'https://localhost/offline');\n"
                "          const refreshed = await this.prisma.booking.findUnique({ where: { id: booking.id }, include: { items: true, payment: true } });\n"
                "          if (refreshed) return refreshed;\n"
                "        }\n"
                "      } catch (err) {\n"
                "        this.logger.warn('offline auto-confirm failed: ' + ((err as Error)?.message || err));\n"
                "      }\n"
            )
            t = t[:r] + inj + t[r:]
    Path('backend/src/bookings/bookings.service.ts').write_text(t, encoding='utf-8')
    print('bookings', len(t))

    p = Path('backend/src/payments/payments.service.ts')
    t = p.read_text(encoding='utf-8')
    if 'settlementEligible' not in t:
        t = t.replace(
            "note: 'Confirmed without online gateway. Not a bank settlement.',",
            "note: 'Confirmed without online gateway. Not a bank settlement.', settlementEligible: false, realMoney: false,",
            1,
        )
        p.write_text(t, encoding='utf-8')
        print('payments')

    p = Path('backend/src/admin/admin-ops.controller.ts')
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        'where: { phone: nextPhone, accountType: existing.accountType, NOT: { id } },',
        'where: { phone: nextPhone, NOT: { id } },',
        1,
    )
    t = t.replace(
        'await this.prisma.user.update({ where: { id }, data: { phone: dto.phone.trim() } });',
        'await this.prisma.user.update({ where: { id }, data: { phone: nextPhone, phoneVerified: false } }); '
        'await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });',
        1,
    )
    t = t.replace(
        "await this.audit(actorId, 'admin.user.profile.update', 'user', id, dto);",
        "await this.audit(actorId, 'admin.user.profile.update', 'user', id, { phoneChanged: !!dto.phone, fieldKeys: Object.keys(dto || {}) });",
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('admin')
    print('ALL OK')

if __name__ == '__main__':
    main()
