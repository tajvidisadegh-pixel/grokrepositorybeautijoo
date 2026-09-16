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

NEW_HDU = """async hardDeleteUser(id: string, actorId?: string) {
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
  }"""
st = replace_method(st, "hardDeleteUser", NEW_HDU)
print("hardDelete done")

if "professional: { is: null }" not in st:
    st = st.replace(
        "const where: Prisma.UserWhereInput = {};",
        "const where: Prisma.UserWhereInput = { professional: { is: null } };",
        1,
    )
    print("listUsers filter")

NEW_STATS = """async getCustomersStats() {
    const base = { professional: { is: null } } as Prisma.UserWhereInput;
    const [total, active, suspended, inactive, withBookings] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.active } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.suspended } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.inactive } }),
      this.prisma.user.count({ where: { ...base, bookingsAsCustomer: { some: {} } } }),
    ]);
    return { total, active, suspended, inactive, withBookings, neverBooked: Math.max(0, total - withBookings) };
  }"""
st = replace_method(st, "getCustomersStats", NEW_STATS)
print("stats done")

if "BadRequestException" not in st.split("from")[0]:
    st = st.replace("NotFoundException,", "NotFoundException,\n  BadRequestException,")
p.write_text(st)

cat = Path("backend/src/admin/admin-catalog.controller.ts")
ct = cat.read_text()
ct2, n1 = re.subn(
    r"async deleteCategory\(@Param\('id'\) id: string\) \{[\s\S]*?return \{ id, deleted: true, soft: true \};\n\}",
    """async deleteCategory(@Param('id') id: string) {
  const row = await this.prisma.serviceCategory.findUnique({ where: { id } });
  if (!row) throw new NotFoundException('category not found');
  await this.prisma.$transaction(async (tx) => {
    const services = await tx.service.findMany({ where: { categoryId: id }, select: { id: true } });
    const serviceIds = services.map((s) => s.id);
    if (serviceIds.length) {
      await tx.professionalService.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await tx.service.deleteMany({ where: { id: { in: serviceIds } } });
    }
    await tx.serviceCategory.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await tx.serviceCategory.delete({ where: { id } });
  });
  return { id, deleted: true, hard: true };
}""",
    ct,
    count=1,
)
ct2, n2 = re.subn(
    r"async deleteCatalogService\(@Param\('id'\) id: string\) \{[\s\S]*?return \{ id, deleted: true, soft: true \};\n\}",
    """async deleteCatalogService(@Param('id') id: string) {
  const row = await this.prisma.service.findUnique({ where: { id } });
  if (!row) throw new NotFoundException('service not found');
  await this.prisma.$transaction(async (tx) => {
    await tx.professionalService.deleteMany({ where: { serviceId: id } });
    await tx.service.delete({ where: { id } });
  });
  return { id, deleted: true, hard: true };
}""",
    ct2,
    count=1,
)
print("catalog", n1, n2)
cat.write_text(ct2)

u = Path("frontend/src/lib/utils.ts")
ut = u.read_text().replace("DateTimeFormat('fa-IR'", "DateTimeFormat('fa-IR-u-ca-persian'")
u.write_text(ut)
print("utils", "fa-IR-u-ca-persian" in ut)

pros = Path("frontend/src/app/admin/professionals/page.tsx")
pt = pros.read_text()
if "adminNotifyUsers" not in pt:
    pt = pt.replace(
        "import { friendlyApiError } from '@/lib/api-errors';",
        "import { friendlyApiError } from '@/lib/api-errors';\nimport { adminNotifyUsers } from '@/lib/panel-api';",
    )
if "async function onNotify" not in pt:
    pt = pt.replace(
        "async function onDelete",
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
        + """<div className=\"flex flex-wrap gap-1\">
                      {p.status !== 'approved' && (
                        <Button size=\"sm\" loading={busyId === p.id} onClick={() => onStatus(p.id, 'approved')}>تأیید</Button>
                      )}
                      <Link href={`/admin/professionals/${p.id}`}>
                        <Button size=\"sm\" variant=\"outline\">ویرایش</Button>
                      </Link>
                      <Button size=\"sm\" variant=\"outline\" loading={busyId === p.id} onClick={() => onNotify(p)}>اعلان</Button>
                      <Button size=\"sm\" variant=\"outline\" loading={busyId === p.id} onClick={() => onDelete(p.id)}>حذف</Button>
                    </div>"""
        + pt[m.end() :]
    )
    print("pros ok")
else:
    print("pros fail")
pros.write_text(pt)
print("ALL DONE")
