#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('backend/src/admin/admin.service.ts')
st = p.read_text()

NEW = '''async hardDeleteUser(id: string, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { professional: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.professional) {
      throw new BadRequestException('این حساب زیباگر است. برای حذف از بخش زیباگرها اقدام کنید.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.booking.deleteMany({ where: { customerId: id } });
      await tx.user.delete({ where: { id } });
    });
    await this.audit(actorId, 'user.hard_delete', 'user', id, { phone: existing.phone }, null);
    return { id, deleted: true };
  }'''

st2, n = re.subn(
    r'async hardDeleteUser\(id: string, actorId\?: string\) \{[\s\S]*?return \{ id, deleted: true \};\n  \}',
    NEW,
    st,
    count=1,
)
print('hardDelete', n)

if 'professional: { is: null }' not in st2:
    st2 = st2.replace(
        'const where: Prisma.UserWhereInput = {};',
        'const where: Prisma.UserWhereInput = { professional: { is: null } };',
        1,
    )
    print('listUsers filter')

STATS = '''async getCustomersStats() {
    const base = { professional: { is: null } } as Prisma.UserWhereInput;
    const [total, active, suspended, inactive, withBookings] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.active } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.suspended } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.inactive } }),
      this.prisma.user.count({ where: { ...base, bookingsAsCustomer: { some: {} } } }),
    ]);
    return { total, active, suspended, inactive, withBookings, neverBooked: Math.max(0, total - withBookings) };
  }'''
st2, n2 = re.subn(r'async getCustomersStats\(\) \{[\s\S]*?\n  \}', STATS, st2, count=1)
print('stats', n2)

if 'BadRequestException' not in st2.split('from')[0]:
    st2 = st2.replace('NotFoundException,', 'NotFoundException,\n  BadRequestException,')
p.write_text(st2)

pros = Path('frontend/src/app/admin/professionals/page.tsx')
pt = pros.read_text()
if 'adminNotifyUsers' not in pt:
    pt = pt.replace(
        "import { friendlyApiError } from '@/lib/api-errors';",
        "import { friendlyApiError } from '@/lib/api-errors';\nimport { adminNotifyUsers } from '@/lib/panel-api';",
    )
if 'async function onNotify' not in pt:
    pt = pt.replace(
        'async function onDelete',
        """async function onNotify(p: AdminProfessional) {
    const title = window.prompt('عنوان اعلان', 'پیام مدیریت');
    if (title == null) return;
    const body = window.prompt('متن اعلان', '');
    if (body == null || !String(body).trim()) return;
    const userId = (p as any).userId || (p as any).user?.id;
    if (!userId) { setError('شناسه کاربر زیباگر یافت نشد'); return; }
    setBusyId(p.id); setError(null); setMsg(null);
    try {
      const res = await adminNotifyUsers({ userIds: [userId], title: title.trim(), body: String(body).trim() });
      setMsg('اعلان ارسال شد (' + String(res.notified ?? 1) + ')');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete""",
    )
m = re.search(
    r'<div className="flex flex-wrap gap-1">[\s\S]*?onDelete\(p\.id\)\}>حذف</Button>\s*</div>',
    pt,
)
if m:
    pt = (
        pt[: m.start()]
        + '''<div className="flex flex-wrap gap-1">
                      {p.status !== 'approved' && (
                        <Button size="sm" loading={busyId === p.id} onClick={() => onStatus(p.id, 'approved')}>تأیید</Button>
                      )}
                      <Link href={`/admin/professionals/${p.id}`}>
                        <Button size="sm" variant="outline">ویرایش</Button>
                      </Link>
                      <Button size="sm" variant="outline" loading={busyId === p.id} onClick={() => onNotify(p)}>اعلان</Button>
                      <Button size="sm" variant="outline" loading={busyId === p.id} onClick={() => onDelete(p.id)}>حذف</Button>
                    </div>'''
        + pt[m.end() :]
    )
    print('pros ok')
else:
    print('pros fail')
pros.write_text(pt)
print('done')
