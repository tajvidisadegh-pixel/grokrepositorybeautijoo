#!/usr/bin/env python3
"""Restore professionals.service.ts from known-good shape and append earnings methods."""
from pathlib import Path

TARGET = Path('backend/src/professionals/professionals.service.ts')

METHODS = r'''
  async getEarnings(userId: string, page = 1, limit = 20) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const take = Math.min(50, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const paidWhere = {
      status: 'paid' as const,
      booking: { professionalId: pro.id },
    };
    const [agg, items, total] = await Promise.all([
      this.prisma.payment.aggregate({
        where: paidWhere,
        _sum: {
          amount: true,
          platformCommissionAmount: true,
          professionalNetAmount: true,
        },
        _count: true,
      }),
      this.prisma.payment.findMany({
        where: paidWhere,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              startAt: true,
              customer: {
                select: {
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where: paidWhere }),
    ]);
    const gross = Number(agg._sum.amount || 0);
    let net = Number(agg._sum.professionalNetAmount || 0);
    let commission = Number(agg._sum.platformCommissionAmount || 0);
    if (!net && gross) {
      commission = Math.round(gross * 0.1);
      net = Math.max(0, gross - commission);
    }
    return {
      summary: {
        grossRevenue: gross,
        platformCommission: commission,
        professionalNet: net,
        paidCount: agg._count,
      },
      items,
      meta: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 0,
      },
      notice:
        'درخواست تسویه در فاز اول به‌صورت دستی بررسی می‌شود. پس از ثبت درخواست، تیم پشتیبانی پیگیری می‌کند.',
    };
  }

  async requestPayout(userId: string, amount: number, note?: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { userId },
      include: { user: { select: { phone: true, profile: { select: { displayName: true } } } } },
    });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const earnings = await this.getEarnings(userId, 1, 1);
    const available = earnings.summary.professionalNet;
    if (amount > available) {
      throw new BadRequestException(
        `مبلغ درخواستی از درآمد خالص موجود (${available.toLocaleString('fa-IR')} ریال) بیشتر است`,
      );
    }
    if (amount < 10000) {
      throw new BadRequestException('حداقل مبلغ درخواست ۱۰٬۰۰۰ ریال است');
    }
    const adminRoles = await this.prisma.role.findMany({
      where: { name: { in: ['SUPER_ADMIN', 'admin'] } },
      select: { id: true },
    });
    const roleIds = adminRoles.map((r) => r.id);
    const adminUsers = roleIds.length
      ? await this.prisma.userRole.findMany({
          where: { roleId: { in: roleIds } },
          select: { userId: true },
        })
      : [];
    const adminIds = Array.from(new Set(adminUsers.map((u) => u.userId)));
    const title = 'درخواست تسویه زیباگر';
    const body = `${pro.user?.profile?.displayName || pro.title} (${pro.user?.phone || '—'}) درخواست تسویه ${amount.toLocaleString('fa-IR')} ریال ثبت کرد.${note ? ' یادداشت: ' + note : ''}`;
    for (const adminId of adminIds) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: adminId,
            type: 'system',
            title,
            body,
            data: {
              type: 'payout_request',
              professionalId: pro.id,
              amount,
              note: note || null,
              availableNet: available,
            },
          },
        });
      } catch {
        pass
      }
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'professional.payout_request',
          entityType: 'professional',
          entityId: pro.id,
          after: { amount, note: note || null, availableNet: available } as any,
        },
      });
    } catch {
      pass
    }
    return {
      success: true,
      message: 'درخواست تسویه ثبت شد و برای بررسی ادمین ارسال گردید.',
      amount,
      availableNet: available,
    };
  }
'''

def main() -> None:
    text = TARGET.read_text()
    if text.strip() == 'PLACEHOLDER' or 'export class ProfessionalsService' not in text:
        raise SystemExit('professionals.service.ts is corrupted; restore from git first')
    if 'async getEarnings' in text:
        print('getEarnings already present')
        return
    text = text.rstrip()
    if text.endswith('}'):
        text = text[:-1]
    # METHODS is TS but has Python 'pass' by mistake in catch - fix when writing
    methods = METHODS.replace('pass\n', '/* non-blocking */\n')
    TARGET.write_text(text + methods + '}\n')
    print('patched', TARGET.stat().st_size)

if __name__ == '__main__':
    main()
