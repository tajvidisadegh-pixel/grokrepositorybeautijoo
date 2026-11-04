#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('backend/src/admin/admin.service.ts')
t = p.read_text()

if 'PayoutStatus' not in t:
    t = t.replace(
        '''import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
''',
        '''import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  UserStatus,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
''',
        1,
    )

# Fix listPayoutRequests where block specifically near the method
old = '''  async listPayoutRequests(page = 1, limit = 20, status?: string) {
    const take = Math.min(Math.max(limit || 20, 1), 100);
    const skip = (Math.max(page || 1, 1) - 1) * take;
    const where: { status?: string } = {};
    if (status) where.status = status;
'''
new = '''  async listPayoutRequests(page = 1, limit = 20, status?: string) {
    const take = Math.min(Math.max(limit || 20, 1), 100);
    const skip = (Math.max(page || 1, 1) - 1) * take;
    const where: { status?: PayoutStatus } = {};
    if (status && (Object.values(PayoutStatus) as string[]).includes(status)) {
      where.status = status as PayoutStatus;
    }
'''
if old in t:
    t = t.replace(old, new, 1)
elif 'async listPayoutRequests' in t and 'PayoutStatus' in t:
    t = t.replace(
        'const where: { status?: string } = {};\n    if (status) where.status = status;',
        'const where: { status?: PayoutStatus } = {};\n    if (status && (Object.values(PayoutStatus) as string[]).includes(status)) {\n      where.status = status as PayoutStatus;\n    }',
        1,
    )

# update status cast
t = t.replace(
    'status,\n        resolvedAt: new Date(),',
    'status: status as PayoutStatus,\n        resolvedAt: new Date(),',
)
# avoid double cast
t = t.replace('status: status as PayoutStatus as PayoutStatus', 'status: status as PayoutStatus')

p.write_text(t)
assert 'PayoutStatus' in t
print('forced ok', p.stat().st_size)
