#!/usr/bin/env python3
"""#75 — transparent finance: settleable vs awaiting, admin mark payout paid."""
from pathlib import Path
import re


def patch_get_earnings() -> None:
    path = Path('backend/src/professionals/professionals.service.ts')
    t = path.read_text()

    # Enhance paidWhere include booking status for classification
    # Find getEarnings method and replace items query + summary available calc

    old_items = '''      this.prisma.payment.findMany({
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
'''
    new_items = '''      this.prisma.payment.findMany({
        where: paidWhere,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              startAt: true,
              endAt: true,
              status: true,
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
'''
    if old_items not in t:
        print('WARN items query pattern not found')
    else:
        t = t.replace(old_items, new_items, 1)

    # After available calc, refine settleable-based available
    # Replace the block from `const available =` through return summary
    old_avail = '''    const available = Math.max(0, allTime.net - settled - pendingPayout);

    return {
      summary: {
        grossRevenue: allTime.gross,
        platformCommission: allTime.commission,
        professionalNet: allTime.net,
        paidCount: allTime.count,
        // automatic balance
        totalEarned: allTime.net,
        totalPaidOut: settled,
        totalPendingPayout: pendingPayout,
        available,
        settledCount,
        pendingCount,
      },
'''

    if 'awaitingServiceNet' not in t:
        # Insert settleable aggregation before available
        insert_before = '    const available = Math.max(0, allTime.net - settled - pendingPayout);'
        settle_block = '''    // #75 — only completed / past-end bookings are settleable
    const nowMs = Date.now();
    const allPaidForStatus = await this.prisma.payment.findMany({
      where: paidWhere,
      select: {
        id: true,
        amount: true,
        status: true,
        professionalNetAmount: true,
        platformCommissionAmount: true,
        booking: { select: { status: true, endAt: true } },
      },
    });
    let awaitingServiceNet = 0;
    let settleableNet = 0;
    let awaitingServiceCount = 0;
    let settleableCount = 0;
    for (const p of allPaidForStatus) {
      const net =
        Number(p.professionalNetAmount || 0) ||
        Math.max(0, Number(p.amount || 0) - Number(p.platformCommissionAmount || 0));
      const b = p.booking;
      const done =
        b?.status === 'completed' ||
        (b?.endAt != null && new Date(b.endAt).getTime() <= nowMs);
      if (done) {
        settleableNet += net;
        settleableCount += 1;
      } else {
        awaitingServiceNet += net;
        awaitingServiceCount += 1;
      }
    }

    const available = Math.max(0, settleableNet - settled - pendingPayout);
'''
        if insert_before not in t:
            raise SystemExit('available line not found')
        t = t.replace(insert_before, settle_block, 1)

        t = t.replace(
            '''      summary: {
        grossRevenue: allTime.gross,
        platformCommission: allTime.commission,
        professionalNet: allTime.net,
        paidCount: allTime.count,
        // automatic balance
        totalEarned: allTime.net,
        totalPaidOut: settled,
        totalPendingPayout: pendingPayout,
        available,
        settledCount,
        pendingCount,
      },
''',
            '''      summary: {
        grossRevenue: allTime.gross,
        platformCommission: allTime.commission,
        professionalNet: allTime.net,
        paidCount: allTime.count,
        totalEarned: allTime.net,
        totalPaidOut: settled,
        totalPendingPayout: pendingPayout,
        available,
        settledCount,
        pendingCount,
        // #75 breakdown
        awaitingServiceNet,
        settleableNet,
        awaitingServiceCount,
        settleableCount,
      },
''',
            1,
        )

    # Map items with financialStatus before return - replace `items,` in return
    if 'financialStatus' not in t:
        t = t.replace(
            '''      items,
      meta: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 0,
      },
      notice:
        'درآمد به‌صورت خودکار از رزروهای پرداخت‌شده محاسبه می‌شود. مبلغ قابل برداشت = درآمد خالص − تسویه‌شده − در صف تسویه.',
    };
''',
            '''      items: items.map((p) => {
        const net =
          Number(p.professionalNetAmount || 0) ||
          Math.max(0, Number(p.amount || 0) - Number(p.platformCommissionAmount || 0));
        const commission = Number(p.platformCommissionAmount || 0);
        const b = p.booking;
        let financialStatus: 'awaiting_service' | 'settleable' | 'refunded' | 'paid' = 'paid';
        if (p.status === 'refunded') financialStatus = 'refunded';
        else if (
          b?.status === 'completed' ||
          (b?.endAt != null && new Date(b.endAt).getTime() <= nowMs)
        )
          financialStatus = 'settleable';
        else financialStatus = 'awaiting_service';
        return {
          ...p,
          professionalNetAmount: net,
          platformCommissionAmount: commission,
          financialStatus,
        };
      }),
      meta: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 0,
      },
      notice:
        'پس از انجام خدمت (یا پایان زمان نوبت) سهم شما قابل تسویه می‌شود. قابل برداشت = قابل تسویه − تسویه‌شده − در صف تسویه.',
    };
''',
            1,
        )

    path.write_text(t)
    print('getEarnings patched', path.stat().st_size)


def patch_admin_payouts() -> None:
    ctrl = Path('backend/src/admin/admin.controller.ts')
    svc = Path('backend/src/admin/admin.service.ts')
    ct = ctrl.read_text()
    st = svc.read_text()

    if 'finance/payout-requests' not in ct:
        # Add routes near finance section
        anchor = "  @RequirePermissions('admin.finance.write')\n  @Post('finance/failed-alert/threshold')"
        routes = '''  @RequirePermissions('admin.finance.read')
  @Get('finance/payout-requests')
  listPayoutRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listPayoutRequests(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @RequirePermissions('admin.finance.write')
  @Patch('finance/payout-requests/:id')
  updatePayoutRequest(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'paid' | 'rejected'; note?: string },
  ) {
    return this.service.updatePayoutRequest(adminUserId, id, body.status, body.note);
  }

  @RequirePermissions('admin.finance.write')
  @Post('finance/failed-alert/threshold')'''
        if anchor not in ct:
            # try alternate insert before end of class
            print('WARN finance anchor missing, appending before last }')
            # Find last occurrence of failed-alert
            idx = ct.find("@Post('finance/failed-alert/threshold')")
            if idx < 0:
                raise SystemExit('cannot find finance routes')
        else:
            ct = ct.replace(anchor, routes, 1)
            ctrl.write_text(ct)
            print('admin controller routes added')

    if 'listPayoutRequests' not in st:
        # Append methods before last closing brace of class
        methods = '''
  // #75 — admin payout queue
  async listPayoutRequests(page = 1, limit = 20, status?: string) {
    const take = Math.min(Math.max(limit || 20, 1), 100);
    const skip = (Math.max(page || 1, 1) - 1) * take;
    const where: { status?: string } = {};
    if (status) where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: {
            select: {
              id: true,
              title: true,
              user: { select: { phone: true, profile: { select: { displayName: true } } } },
            },
          },
        },
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);
    return {
      items,
      meta: { page: Math.max(1, page), limit: take, total, totalPages: Math.ceil(total / take) || 0 },
    };
  }

  async updatePayoutRequest(
    adminUserId: string,
    id: string,
    status: 'approved' | 'paid' | 'rejected',
    note?: string,
  ) {
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('درخواست تسویه یافت نشد');
    const data: { status: string; processedAt?: Date; adminNote?: string | null } = {
      status,
      processedAt: new Date(),
    };
    if (note != null) data.adminNote = note;
    const updated = await this.prisma.payoutRequest.update({ where: { id }, data: data as never });
    await this.audit(
      adminUserId,
      'finance.payout_update',
      'payout_request',
      id,
      { status: row.status },
      { status, note: note ?? null },
    );
    return updated;
  }
'''
        # insert before final `}\n` of class - last line
        if not st.rstrip().endswith('}'):
            raise SystemExit('admin.service unexpected end')
        # Find last }
        st = st.rstrip()
        if st.endswith('}'):
            st = st[:-1] + methods + '}\n'
        svc.write_text(st)
        print('admin service payout methods added')

    # Ensure Patch import in controller
    if 'Patch' not in ct.split('from \'@nestjs/common\'')[0] if False else True:
        ct = ctrl.read_text()
        if 'Patch' not in ct:
            ct = ct.replace(
                'Controller,',
                'Controller,\n  Patch,',
                1,
            )
            # better: from @nestjs/common import line
            ct = re.sub(
                r"from '@nestjs/common';",
                lambda m: m.group(0),
                ct,
                count=1,
            )
            if re.search(r"import \{([^}]+)\} from '@nestjs/common'", ct):
                ct = re.sub(
                    r"import \{([^}]+)\} from '@nestjs/common'",
                    lambda m: (
                        m.group(0)
                        if 'Patch' in m.group(1)
                        else "import {" + m.group(1).rstrip() + ", Patch} from '@nestjs/common'"
                    ),
                    ct,
                    count=1,
                )
            ctrl.write_text(ct)
            print('Patch import ensured')


def patch_earnings_ui() -> None:
    path = Path('frontend/src/app/zibagar/earnings/page.tsx')
    t = path.read_text()

    # Fix payout API path
    t = t.replace(
        "/professionals/me/payout-requests",
        "/professionals/me/payout-request",
    )

    # Expand summary type usage - replace simple cards with clearer breakdown
    if 'قابل تسویه' not in t:
        old_summary = '''      {summary && (
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray">خالص حرفه‌ای</p>
            <p className="text-lg font-bold text-coral">{formatPrice(summary.professionalNet)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">تعداد پرداخت‌شده</p>
            <p className="text-lg font-bold">{summary.paidCount.toLocaleString('fa-IR')}</p>
          </div>
        </Card>
      )}
'''
        new_summary = '''      {summary && (
        <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-gray">مبلغ کل پرداخت‌شده</p>
            <p className="text-lg font-bold">{formatPrice(summary.grossRevenue ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">سهم پلتفرم (کمیسیون)</p>
            <p className="text-lg font-bold">{formatPrice(summary.platformCommission ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">سهم شما (خالص)</p>
            <p className="text-lg font-bold text-coral">{formatPrice(summary.professionalNet ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">در انتظار انجام خدمت</p>
            <p className="text-lg font-bold">{formatPrice(summary.awaitingServiceNet ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">قابل تسویه</p>
            <p className="text-lg font-bold text-blue">{formatPrice(summary.settleableNet ?? summary.available ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">قابل برداشت الان</p>
            <p className="text-lg font-bold text-coral">{formatPrice(summary.available ?? 0)}</p>
          </div>
        </Card>
      )}
'''
        if old_summary in t:
            t = t.replace(old_summary, new_summary, 1)
            print('summary cards updated')
        else:
            print('WARN summary block not exact')

    # Status label helper for items
    if 'financialStatusLabel' not in t:
        t = t.replace(
            "export default function ZibagarEarningsPage()",
            '''function financialStatusLabel(s?: string, paymentStatus?: string) {
  if (paymentStatus === 'refunded' || s === 'refunded') return 'استردادشده';
  if (s === 'awaiting_service') return 'در انتظار انجام';
  if (s === 'settleable') return 'قابل تسویه';
  if (s === 'settled' || paymentStatus === 'paid') return 'پرداخت‌شده';
  return s || paymentStatus || '—';
}

export default function ZibagarEarningsPage()''',
            1,
        )

    # Item row show commission + status fa
    t = t.replace(
        '''              <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>{formatPrice(it.professionalNetAmount ?? it.amount)}</span>
                <span className="text-gray">{it.status}</span>
                <span className="text-xs text-gray">{formatDate(it.createdAt)}</span>
              </Card>
''',
        '''              <Card className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">سهم شما: {formatPrice(it.professionalNetAmount ?? it.amount)}</span>
                  <span className="rounded-full bg-gray-light px-2 py-0.5 text-xs">
                    {financialStatusLabel((it as { financialStatus?: string }).financialStatus, it.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray">
                  <span>کل: {formatPrice(it.amount)}</span>
                  <span>کمیسیون: {formatPrice((it as { platformCommissionAmount?: number }).platformCommissionAmount ?? 0)}</span>
                  <span>{formatDate(it.createdAt)}</span>
                </div>
              </Card>
''',
        1,
    )

    path.write_text(t)
    print('earnings UI', path.stat().st_size)


def patch_admin_finance_ui() -> None:
    path = Path('frontend/src/app/admin/finance/page.tsx')
    if not path.exists():
        print('no admin finance page')
        return
    t = path.read_text()
    if 'payout-requests' in t or 'درخواست‌های تسویه' in t:
        print('admin payout UI maybe present')
        return

    # Add simple payout section at end before last closing
    # Append API helpers inline
    if 'loadPayouts' not in t:
        # Insert state after other useStates - light touch: add section with fetch on mount via useEffect append
        marker = 'export default function'
        # Skip heavy refactor - inject minimal block before final return close
        # Add after commission card area a payout requests list
        inject = '''
      {/* #75 payout queue */}
      <Card className="mt-6 space-y-3 p-4">
        <h2 className="font-bold">درخواست‌های تسویه زیباگران</h2>
        <p className="text-xs text-gray">پس از واریز دستی، وضعیت را «تسویه‌شده» کنید.</p>
        <PayoutRequestsPanel />
      </Card>
'''
        # Find a good place - before last `</div>` of main return
        # Look for end of main container
        if 'settings/commission' in t or 'کمیسیون' in t:
            # insert before last 3 closing divs
            idx = t.rfind('</div>')
            if idx > 0:
                t = t[:idx] + inject + t[idx:]
                print('injected payout panel placeholder')

        # Add component at end of file
        t += '''

function PayoutRequestsPanel() {
  const [items, setItems] = useState<Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    professional?: { title?: string | null; user?: { phone?: string | null } | null } | null;
  }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items?: typeof items }>("/admin/finance/payout-requests");
      setItems(res.items || []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mark(id: string, status: "paid" | "rejected" | "approved") {
    setBusy(id);
    setMsg(null);
    try {
      await apiClient.patch(`/admin/finance/payout-requests/${id}`, { status });
      setMsg(status === "paid" ? "به‌عنوان تسویه‌شده ثبت شد" : "وضعیت به‌روز شد");
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) return <p className="text-sm text-gray">درخواستی در صف نیست.</p>;
  return (
    <div className="space-y-2">
      {msg && <p className="text-xs text-blue">{msg}</p>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
            <div>
              <p className="font-medium">{it.professional?.title || "زیباگر"}</p>
              <p className="text-xs text-gray">{it.professional?.user?.phone}</p>
              <p className="text-xs text-gray">{it.status} · {new Date(it.createdAt).toLocaleDateString("fa-IR")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-coral">{Number(it.amount).toLocaleString("fa-IR")} تومان</span>
              {it.status !== "paid" && (
                <Button size="sm" loading={busy === it.id} onClick={() => void mark(it.id, "paid")}>
                  تسویه‌شده
                </Button>
              )}
              {it.status === "pending" && (
                <Button size="sm" variant="outline" loading={busy === it.id} onClick={() => void mark(it.id, "rejected")}>
                  رد
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
'''
        path.write_text(t)
        print('admin finance payout UI added', path.stat().st_size)


if __name__ == '__main__':
    patch_get_earnings()
    patch_admin_payouts()
    patch_earnings_ui()
    patch_admin_finance_ui()
