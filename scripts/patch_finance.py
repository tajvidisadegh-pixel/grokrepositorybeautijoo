#!/usr/bin/env python3
from pathlib import Path
import re

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

p = Path("backend/src/admin/admin.service.ts")
st = p.read_text()

NEW_SUMMARY = """async getFinancialSummary(_period?: string) {
    const period = _period || 'all_time';
    const now = new Date();
    let createdAt: Prisma.DateTimeFilter | undefined;
    if (period === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      createdAt = { gte: start };
    } else if (period === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      createdAt = { gte: start };
    }
    const baseWhere: Prisma.PaymentWhereInput = createdAt ? { createdAt } : {};
    const [paidAgg, commissionAgg, paidCount, failedCount, pendingCount] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: PaymentStatus.paid },
        _sum: { amount: true, platformCommissionAmount: true, professionalNetAmount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: PaymentStatus.paid },
        _sum: { platformCommissionAmount: true, professionalNetAmount: true },
      }),
      this.prisma.payment.count({ where: { ...baseWhere, status: PaymentStatus.paid } }),
      this.prisma.payment.count({ where: { ...baseWhere, status: PaymentStatus.failed } }),
      this.prisma.payment.count({ where: { ...baseWhere, status: PaymentStatus.pending } }),
    ]);
    const grossRevenue = Number(paidAgg._sum.amount || 0);
    let platformCommission = Number(commissionAgg._sum.platformCommissionAmount || 0);
    let professionalNet = Number(commissionAgg._sum.professionalNetAmount || 0);
    if (!platformCommission && grossRevenue) {
      const rate = (await this.getCommissionSetting()).rate;
      platformCommission = Math.round(grossRevenue * (rate / 100));
      professionalNet = Math.max(0, grossRevenue - platformCommission);
    }
    return {
      period,
      grossRevenue,
      platformCommission,
      professionalNet,
      transactions: {
        paid: paidCount,
        failed: failedCount,
        pending: pendingCount,
      },
    };
  }"""

NEW_LIST = """async listFinancialTransactions(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.provider) where.provider = String(q.provider);
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { providerRef: { contains: s, mode: 'insensitive' } },
        { booking: { customer: { phone: { contains: s } } } },
        { booking: { customer: { profile: { displayName: { contains: s, mode: 'insensitive' } } } } },
        { booking: { professional: { title: { contains: s, mode: 'insensitive' } } } },
      ];
    }
    if (q.startDate || q.endDate) {
      where.createdAt = {};
      if (q.startDate) where.createdAt.gte = new Date(q.startDate);
      if (q.endDate) where.createdAt.lte = new Date(q.endDate);
    }
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              customer: { select: { phone: true, profile: { select: { displayName: true } } } },
              professional: { select: { title: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }"""

NEW_DETAIL = """async getFinancialTransactionDetail(id: string) {
    const row = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            startAt: true,
            totalPrice: true,
            customer: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
            professional: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Transaction not found');
    return row;
  }"""

NEW_COMMISSION_GET = """async getCommissionSetting() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'commission_rate' } });
    const rate = row && typeof (row.value as any)?.rate === 'number' ? Number((row.value as any).rate) : 10;
    return { rate, notice: null };
  }"""

NEW_COMMISSION_SET = """async updateCommissionSetting(newRate: number, adminUserId?: string) {
    const rate = Math.min(100, Math.max(0, Number(newRate)));
    const value = { rate } as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'commission_rate' },
      create: { key: 'commission_rate', value },
      update: { value },
    });
    await this.audit(adminUserId, 'finance.commission_update', 'platform_setting', 'commission_rate', null, value);
    return { rate, notice: 'نرخ کارمزد ذخیره شد' };
  }"""

NEW_FAILED = """async getFailedTransactionsAlert() {
    const thresholdRow = await this.prisma.platformSetting.findUnique({ where: { key: 'failed_alert_threshold' } });
    const threshold = thresholdRow && typeof (thresholdRow.value as any)?.threshold === 'number'
      ? Number((thresholdRow.value as any).threshold)
      : 5;
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const failedCount = await this.prisma.payment.count({
      where: { status: PaymentStatus.failed, createdAt: { gte: since } },
    });
    const recent = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.failed },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        booking: {
          select: {
            customer: { select: { profile: { select: { displayName: true } }, phone: true } },
            professional: { select: { title: true } },
          },
        },
      },
    });
    return {
      failedCount,
      threshold,
      isTriggered: failedCount >= threshold,
      recentFailed: recent.map((r) => ({
        id: r.id,
        amount: r.amount,
        failedAt: r.failedAt || r.createdAt,
        customerName: r.booking?.customer?.profile?.displayName || r.booking?.customer?.phone || '—',
        professionalTitle: r.booking?.professional?.title || null,
      })),
    };
  }"""

NEW_THRESHOLD = """async setFailedTransactionsThreshold(threshold: number, actorId?: string) {
    const t = Math.max(0, Math.floor(Number(threshold) || 0));
    const value = { threshold: t } as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'failed_alert_threshold' },
      create: { key: 'failed_alert_threshold', value },
      update: { value },
    });
    await this.audit(actorId, 'finance.failed_threshold', 'platform_setting', 'failed_alert_threshold', null, value);
    return this.getFailedTransactionsAlert();
  }"""

st = replace_method(st, "getFinancialSummary", NEW_SUMMARY)
st = replace_method(st, "listFinancialTransactions", NEW_LIST)
st = replace_method(st, "getFinancialTransactionDetail", NEW_DETAIL)
st = replace_method(st, "getCommissionSetting", NEW_COMMISSION_GET)
st = replace_method(st, "updateCommissionSetting", NEW_COMMISSION_SET)
st = replace_method(st, "getFailedTransactionsAlert", NEW_FAILED)

if "setFailedTransactionsThreshold" not in st:
    marker = "async listUsers("
    idx = st.find(marker)
    if idx > 0:
        st = st[:idx] + NEW_THRESHOLD + "\n\n  " + st[idx:]
        print("threshold method added")
    else:
        print("listUsers marker missing")

p.write_text(st)
print("service finance methods updated")

ctrl = Path("backend/src/admin/admin.controller.ts")
ct = ctrl.read_text()
if "failed-alert/threshold" not in ct:
    insert = """
  @Post('finance/settings/commission')
  setCommissionPost(@Body() dto: CommissionDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateCommissionSetting(dto.rate, actorId);
  }

  @Post('finance/failed-alert/threshold')
  setFailedThreshold(@Body() body: { threshold?: number }, @CurrentUser('id') actorId?: string) {
    return this.service.setFailedTransactionsThreshold(Number(body?.threshold ?? 0), actorId);
  }

"""
    ct = ct.replace(
        "  @Get('finance/failed-alert')\n  failedAlert() {\n    return this.service.getFailedTransactionsAlert();\n  }",
        "  @Get('finance/failed-alert')\n  failedAlert() {\n    return this.service.getFailedTransactionsAlert();\n  }\n" + insert,
    )
    ctrl.write_text(ct)
    print("controller routes added")
else:
    print("controller already has threshold")

fin = Path("frontend/src/app/admin/finance/page.tsx")
if fin.exists():
    ft = fin.read_text()
    ft2 = ft.replace(
        "{summary.transactions.paid} / {summary.transactions.failed}",
        "{summary.transactions?.paid ?? 0} / {summary.transactions?.failed ?? 0}",
    )
    ft2 = ft2.replace(
        "formatPrice(summary.platformCommission)",
        "formatPrice(summary.platformCommission ?? 0)",
    )
    ft2 = ft2.replace(
        "formatPrice(summary.professionalNet)",
        "formatPrice(summary.professionalNet ?? 0)",
    )
    fin.write_text(ft2)
    print("frontend defensive")

print("ALL DONE")
