#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess

good = subprocess.check_output(
    ["git", "show", "e8db68381a14:backend/src/auth/auth.service.ts"],
    text=True,
)
path = Path("backend/src/auth/auth.service.ts")
start = good.find("  async deleteAccount(")
if start < 0:
    raise SystemExit("deleteAccount not found in good commit")
prefix = good[:start]

new_method = """  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, professional: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.status === UserStatus.deleted) {
      throw new BadRequestException('این حساب قبلاً حذف شده است');
    }
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('رمز عبور برای تأیید حذف الزامی است');
      }
      const ok = await argon2.verify(user.passwordHash, dto.password);
      if (!ok) {
        throw new UnauthorizedException('رمز عبور اشتباه است');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.deleted,
          phone: null,
          email: null,
          passwordHash: null,
          phoneVerified: false,
          emailVerified: false,
        },
      });
      if (user.profile) {
        await tx.profile.update({
          where: { userId },
          data: {
            displayName: 'کاربر حذف‌شده',
            firstName: null,
            lastName: null,
            bio: null,
            avatarUrl: null,
            birthDate: null,
            gender: 'undisclosed',
          },
        });
      }
      if (user.professional) {
        await tx.professional.update({
          where: { userId },
          data: {
            status: ProfessionalStatus.suspended,
            publishedAt: null,
            isFeatured: false,
          },
        });
      }
      await tx.booking.updateMany({
        where: {
          customerId: userId,
          status: { in: ['pending', 'confirmed'] },
        },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'account_deleted',
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.account_delete',
            entityType: 'user',
            entityId: userId,
            after: { anonymized: true, status: 'deleted' } as any,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'حساب کاربری با موفقیت حذف و داده‌های شخصی ناشناس شد' };
  }
}
"""

path.write_text(prefix + new_method)
text = path.read_text()
assert "phone: null" in text
print("auth.service.ts OK", len(text))

api = Path("frontend/src/lib/panel-api.ts")
if api.exists():
    at = api.read_text()
    at2 = at.replace(
        "export async function deleteAccount(payload: { password: string })",
        "export async function deleteAccount(payload: { password?: string } = {})",
    )
    if at2 != at:
        api.write_text(at2)
        print("panel-api OK")
    else:
        print("panel-api unchanged")

sp = Path("frontend/src/app/panel/settings/page.tsx")
if sp.exists():
    st = sp.read_text()
    old = """if (!deletePassword) {
      setDelErr('رمز عبور الزامی است');
      return;
    }
    setDelLoading(true);
    try {
      const res = await deleteAccount({ password: deletePassword });"""
    new = """setDelLoading(true);
    try {
      const payload = deletePassword ? { password: deletePassword } : {};
      const res = await deleteAccount(payload);"""
    if old in st:
        st = st.replace(old, new)
        sp.write_text(st)
        print("settings OK")
    else:
        print("settings pattern not found")
