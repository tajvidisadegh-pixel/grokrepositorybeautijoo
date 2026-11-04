#!/usr/bin/env python3
from pathlib import Path

# Frontend type
p = Path('frontend/src/app/zibagar/earnings/page.tsx')
t = p.read_text()
old = '''type EarningsSummary = {
  professionalNet: number;
  paidCount: number;
  totalEarned?: number;
  totalPaidOut?: number;
  totalPendingPayout?: number;
  available?: number;
  settledCount?: number;
  pendingCount?: number;
};
'''
new = '''type EarningsSummary = {
  professionalNet: number;
  paidCount: number;
  grossRevenue?: number;
  platformCommission?: number;
  totalEarned?: number;
  totalPaidOut?: number;
  totalPendingPayout?: number;
  available?: number;
  settledCount?: number;
  pendingCount?: number;
  awaitingServiceNet?: number;
  settleableNet?: number;
  awaitingServiceCount?: number;
  settleableCount?: number;
};
'''
if old not in t:
    raise SystemExit('EarningsSummary not found')
p.write_text(t.replace(old, new, 1))
print('earnings type ok')

# PaymentRow financialStatus
if 'financialStatus?' not in t:
    t = p.read_text()
    t = t.replace(
        '''type PaymentRow = {
  id: string;
  amount: number;
  professionalNetAmount?: number | null;
  status: string;
''',
        '''type PaymentRow = {
  id: string;
  amount: number;
  professionalNetAmount?: number | null;
  platformCommissionAmount?: number | null;
  financialStatus?: string;
  status: string;
''',
        1,
    )
    p.write_text(t)
    print('PaymentRow extended')

# Backend Prisma types
sp = Path('backend/src/admin/admin.service.ts')
st = sp.read_text()
if 'PayoutStatus' not in st.split('from \'@prisma/client\'')[0] if False else 'PayoutStatus' not in st:
    st = st.replace(
        'PaymentStatus,\n  UserStatus,',
        'PaymentStatus,\n  PayoutStatus,\n  UserStatus,',
        1,
    )
# fix where type
st = st.replace(
    '''    const where: { status?: string } = {};
    if (status) where.status = status;
''',
    '''    const where: { status?: PayoutStatus } = {};
    if (status && ['pending', 'approved', 'paid', 'rejected', 'cancelled'].includes(status)) {
      where.status = status as PayoutStatus;
    }
''',
    1,
)
# fix update status cast
st = st.replace(
    '''      data: {
        status,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        adminNote: note != null ? note : undefined,
      },
''',
    '''      data: {
        status: status as PayoutStatus,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        adminNote: note != null ? note : undefined,
      },
''',
    1,
)
sp.write_text(st)
print('admin service types ok')
