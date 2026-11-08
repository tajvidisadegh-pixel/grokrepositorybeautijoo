#!/usr/bin/env python3
"""Fix admin critical/high issues from r4 review."""
from pathlib import Path

# ---------------------------------------------------------------------------
# 1) admin.controller.ts
# ---------------------------------------------------------------------------
ctrl = Path("backend/src/admin/admin.controller.ts")
ct = ctrl.read_text(encoding="utf-8")

# C1: dashboard permission
if "@Get('dashboard')" in ct and "admin.dashboard.read" not in ct[ct.find("@Get('dashboard')")-80:ct.find("@Get('dashboard')")+80]:
    ct = ct.replace(
        "  @Get('dashboard')\n  dashboard() {",
        "  @RequirePermissions('admin.dashboard.read')\n  @Get('dashboard')\n  dashboard() {",
        1,
    )
    print("C1 dashboard permission")

# C3: hard delete SUPER_ADMIN only
ct = ct.replace(
    "  @RequirePermissions('admin.users.write')\n  @Delete('users/:id')\n  hardDeleteUser(",
    "  @Roles('SUPER_ADMIN')\n  @Delete('users/:id')\n  hardDeleteUser(",
    1,
)
ct = ct.replace(
    "  @RequirePermissions('admin.users.write')\n  @Post('users/bulk-delete')\n  bulkHardDeleteUsers(",
    "  @Roles('SUPER_ADMIN')\n  @Post('users/bulk-delete')\n  bulkHardDeleteUsers(",
    1,
)
ct = ct.replace(
    "  @RequirePermissions('admin.professionals.write')\n  @Delete('professionals/:id')\n  hardDeleteProfessional(",
    "  @Roles('SUPER_ADMIN')\n  @Delete('professionals/:id')\n  hardDeleteProfessional(",
    1,
)
print("C3 hard-delete SUPER_ADMIN")

# C5: payout DTO validation class if missing
if "class PayoutStatusDto" not in ct:
    ct = ct.replace(
        "class BulkDeleteUsersDto {",
        "class PayoutStatusDto {\n  @ApiProperty({ enum: ['approved', 'paid', 'rejected'] })\n  @IsString()\n  status!: 'approved' | 'paid' | 'rejected';\n  @ApiPropertyOptional()\n  @IsOptional()\n  @IsString()\n  note?: string;\n}\n\nclass BulkDeleteUsersDto {",
        1,
    )
    ct = ct.replace(
        "@Body() body: { status: 'approved' | 'paid' | 'rejected'; note?: string },",
        "@Body() body: PayoutStatusDto,",
        1,
    )
    print("C5 payout DTO")

ctrl.write_text(ct, encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) admin.service.ts surgical replacements
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

# C6: commission always { rate }
st = st.replace(
    "create: { key: 'commission_rate', value: rate as unknown as object },\n        update: { value: rate as unknown as object },",
    "create: { key: 'commission_rate', value: { rate } as object },\n        update: { value: { rate } as object },",
    1,
)
print("C6 commission format")

# H8: getBookingsStats use stored rate
old_stats = """    const grossRevenue = Number(paidAgg._sum.amount || 0);
    const commissionRate = 10;
    return {
      total,
      today,
      pending,
      completed,
      cancelled,
      grossRevenue,
      platformShare: Math.round(grossRevenue * (commissionRate / 100)),
      commissionRate,
      failedPayments,
    };"""
new_stats = """    const grossRevenue = Number(paidAgg._sum.amount || 0);
    const commissionRate = (await this.getCommissionSetting()).rate;
    return {
      total,
      today,
      pending,
      completed,
      cancelled,
      grossRevenue,
      platformShare: Math.round(grossRevenue * (commissionRate / 100)),
      commissionRate,
      failedPayments,
    };"""
if old_stats in st:
    st = st.replace(old_stats, new_stats, 1)
    print("H8 bookings stats rate")

# C7: publishSiteCms — do NOT overwrite draft with published snapshot
old_pub = """    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_published' },
      create: { key: 'site_cms_published', value },
      update: { value },
    });
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_draft' },
      create: { key: 'site_cms_draft', value },
      update: { value },
    });"""
new_pub = """    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_published' },
      create: { key: 'site_cms_published', value },
      update: { value },
    });
    // Keep draft as-is so unpublished edits are not wiped (#r4.C7)"""
if old_pub in st:
    st = st.replace(old_pub, new_pub, 1)
    print("C7 publish keeps draft")

# C4: updateBookingStatus state machine
old_ubs = """  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const data: Prisma.BookingUpdateInput = { status };
    if (reason) data.cancelReason = reason;
    if (status === BookingStatus.cancelled) data.cancelledAt = new Date();
    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    if (status === BookingStatus.completed) data.completedAt = new Date();
    const updated = await this.prisma.booking.update({ where: { id }, data });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: existing.status }, { status, reason });
    return updated;
  }"""
new_ubs = """  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!existing) throw new NotFoundException('Booking not found');

    const from = existing.status;
    const allowed: Record<string, BookingStatus[]> = {
      [BookingStatus.pending]: [BookingStatus.confirmed, BookingStatus.rejected, BookingStatus.cancelled, BookingStatus.expired],
      [BookingStatus.confirmed]: [BookingStatus.completed, BookingStatus.cancelled, BookingStatus.no_show],
      [BookingStatus.rejected]: [],
      [BookingStatus.cancelled]: [],
      [BookingStatus.completed]: [],
      [BookingStatus.expired]: [],
      [BookingStatus.no_show]: [],
    };
    const nextOk = (allowed[from] || []).includes(status);
    if (!nextOk) {
      throw new BadRequestException(`انتقال وضعیت از ${from} به ${status} مجاز نیست`);
    }

    // Payment = confirmed slot: cannot confirm/complete unpaid; cancel paid needs explicit reason
    const payStatus = existing.payment?.status;
    if (status === BookingStatus.confirmed || status === BookingStatus.completed) {
      if (payStatus && payStatus !== PaymentStatus.paid && payStatus !== PaymentStatus.refunded) {
        throw new BadRequestException('بدون پرداخت موفق نمی‌توان رزرو را تأیید یا تکمیل کرد');
      }
    }
    if (status === BookingStatus.cancelled && payStatus === PaymentStatus.paid) {
      if (!reason || !String(reason).trim()) {
        throw new BadRequestException('لغو رزرو پرداخت‌شده نیازمند دلیل است (استرداد جداگانه انجام شود)');
      }
    }

    const data: Prisma.BookingUpdateInput = { status };
    if (reason) data.cancelReason = reason;
    if (status === BookingStatus.cancelled) data.cancelledAt = new Date();
    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    if (status === BookingStatus.completed) data.completedAt = new Date();
    if (status === BookingStatus.no_show) data.noShowAt = new Date();
    const updated = await this.prisma.booking.update({ where: { id }, data });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: from, payStatus }, { status, reason });
    return updated;
  }"""
if old_ubs in st:
    st = st.replace(old_ubs, new_ubs, 1)
    print("C4 booking state machine")
else:
    print("C4 pattern miss")

# C5: payout transitions
old_po = """  async updatePayoutRequest(
    adminUserId: string,
    id: string,
    status: 'approved' | 'paid' | 'rejected',
    note?: string,
  ) {
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('درخواست تسویه یافت نشد');
    const updated = await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: status as PayoutStatus,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        adminNote: note != null ? note : undefined,
      },
    });"""
new_po = """  async updatePayoutRequest(
    adminUserId: string,
    id: string,
    status: 'approved' | 'paid' | 'rejected',
    note?: string,
  ) {
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('درخواست تسویه یافت نشد');
    const from = String(row.status);
    const allowed: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['paid', 'rejected'],
      paid: [],
      rejected: [],
      cancelled: [],
    };
    if (!(allowed[from] || []).includes(status)) {
      throw new BadRequestException(`انتقال وضعیت تسویه از ${from} به ${status} مجاز نیست`);
    }
    const updated = await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: status as PayoutStatus,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        adminNote: note != null ? note : undefined,
      },
    });"""
if old_po in st:
    st = st.replace(old_po, new_po, 1)
    print("C5 payout transitions")
else:
    print("C5 pattern miss")

# C3: hardDelete guards
old_hdu = """  async hardDeleteUser(id: string, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { professional: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.professional) {
      throw new BadRequestException('این حساب زیباگر است. برای حذف از بخش زیباگرها اقدام کنید.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.booking.deleteMany({ where: { customerId: id } });
      await tx.user.delete({ where: { id } });
    });"""
new_hdu = """  async hardDeleteUser(id: string, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { professional: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.professional) {
      throw new BadRequestException('این حساب زیباگر است. برای حذف از بخش زیباگرها اقدام کنید.');
    }
    const activeBookings = await this.prisma.booking.count({
      where: { customerId: id, status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
    });
    if (activeBookings > 0) {
      throw new BadRequestException('کاربر رزرو فعال دارد؛ ابتدا رزروها را لغو کنید');
    }
    const paidOpen = await this.prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.paid, PaymentStatus.processing, PaymentStatus.pending] },
        booking: { customerId: id },
      },
    });
    if (paidOpen > 0) {
      throw new BadRequestException('سوابق پرداخت باز/پرداخت‌شده وجود دارد؛ حذف دائمی مجاز نیست');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.booking.deleteMany({ where: { customerId: id } });
      await tx.user.delete({ where: { id } });
    });"""
if old_hdu in st:
    st = st.replace(old_hdu, new_hdu, 1)
    print("C3 hardDeleteUser guards")

old_hdp = """  async hardDeleteProfessional(id: string, actorId?: string) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('Professional not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.booking.deleteMany({ where: { professionalId: id } });
      await tx.professional.delete({ where: { id } });
    });"""
new_hdp = """  async hardDeleteProfessional(id: string, actorId?: string) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('Professional not found');
    const activeBookings = await this.prisma.booking.count({
      where: { professionalId: id, status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
    });
    if (activeBookings > 0) {
      throw new BadRequestException('زیباگر رزرو فعال دارد؛ ابتدا رزروها را مدیریت کنید');
    }
    const paidOpen = await this.prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.paid, PaymentStatus.processing, PaymentStatus.pending] },
        booking: { professionalId: id },
      },
    });
    if (paidOpen > 0) {
      throw new BadRequestException('سوابق پرداخت مرتبط وجود دارد؛ حذف دائمی مجاز نیست');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.booking.deleteMany({ where: { professionalId: id } });
      await tx.professional.delete({ where: { id } });
    });"""
if old_hdp in st:
    st = st.replace(old_hdp, new_hdp, 1)
    print("C3 hardDeleteProfessional guards")

# H6 bulk limit
old_bulk = """  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.hardDeleteUser(id, actorId);
        deleted += 1;
      } catch {
        failed.push(id);
      }
    }
    return { deleted, failed };
  }"""
new_bulk = """  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean))).slice(0, 50);
    if ((userIds || []).length > 50) {
      throw new BadRequestException('حداکثر ۵۰ کاربر در هر درخواست');
    }
    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.hardDeleteUser(id, actorId);
        deleted += 1;
      } catch (e) {
        failed.push(id);
        this.logger.warn(`bulkHardDelete fail ${id}: ${(e as Error)?.message || e}`);
      }
    }
    return { deleted, failed, cappedAt: 50 };
  }"""
if old_bulk in st:
    st = st.replace(old_bulk, new_bulk, 1)
    print("H6 bulk limit")

# H3+H4: approve professional checks + no auto-publish all media
old_approve_block = """    // Public catalog requires status=approved AND publishedAt != null
    if (status === ProfessionalStatus.approved) {
      data.publishedAt = existing.publishedAt || new Date();
      data.verifiedAt = existing.verifiedAt || new Date();
    } else if ("""
new_approve_block = """    // Public catalog requires status=approved AND publishedAt != null
    if (status === ProfessionalStatus.approved) {
      const [svcCount, locCount] = await Promise.all([
        this.prisma.professionalService.count({ where: { professionalId: id, isActive: true } }),
        this.prisma.professionalLocation.count({ where: { professionalId: id } }),
      ]);
      if (svcCount < 1) {
        throw new BadRequestException('برای تأیید، حداقل یک خدمت فعال لازم است');
      }
      if (locCount < 1) {
        throw new BadRequestException('برای تأیید، ثبت آدرس لازم است');
      }
      data.publishedAt = existing.publishedAt || new Date();
      data.verifiedAt = existing.verifiedAt || new Date();
    } else if ("""
if old_approve_block in st:
    st = st.replace(old_approve_block, new_approve_block, 1)
    print("H3 approve checks")

# Remove auto-publish all draft media on approve
old_media = """    // On approve, publish draft portfolio media so it becomes visible
    if (status === ProfessionalStatus.approved) {
      await this.prisma.mediaAsset
        .updateMany({
          where: { professionalId: id, status: MediaStatus.draft },
          data: { status: MediaStatus.published },
        })
        .catch(() => undefined);
    }
"""
if old_media in st:
    st = st.replace(old_media, "    // Media stays draft until explicitly moderated (#r4.H4)\n", 1)
    print("H4 no auto-publish media")

# H10 listBookings validate paymentStatus
old_lb = "    if (q.status) where.status = q.status;\n    if (q.paymentStatus) where.payment = { status: q.paymentStatus };"
new_lb = """    if (q.status) {
      if (!Object.values(BookingStatus).includes(q.status)) {
        throw new BadRequestException('status نامعتبر');
      }
      where.status = q.status;
    }
    if (q.paymentStatus) {
      if (!Object.values(PaymentStatus).includes(q.paymentStatus)) {
        throw new BadRequestException('paymentStatus نامعتبر');
      }
      where.payment = { status: q.paymentStatus };
    }"""
if old_lb in st:
    st = st.replace(old_lb, new_lb, 1)
    print("H10 listBookings enum")

# C2: setUserRoles — actor must hold roles being granted (unless SUPER_ADMIN)
# Insert after SUPER_ADMIN check block, before roleRows lookup
needle = "    const roleRows = await this.prisma.role.findMany({\n      where: {\n        OR: [\n          { name: { in: normalized, mode: 'insensitive' } },\n          { displayName: { in: normalized, mode: 'insensitive' } },\n        ],\n      },\n    });"
insert = """    // #r4.C2 — non-SUPER_ADMIN may only assign roles they themselves hold
    if (actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        include: { userRoles: { include: { role: true } } },
      });
      const actorRoles = (actor?.userRoles || []).map((ur) => ur.role.name);
      const isSuper = actorRoles.includes('SUPER_ADMIN');
      if (!isSuper) {
        const actorLower = new Set(actorRoles.map((r) => r.toLowerCase()));
        const forbidden = normalized.filter((r) => !actorLower.has(r.toLowerCase()));
        if (forbidden.length) {
          throw new ForbiddenException(`نمی‌توانید نقش‌هایی که خودتان ندارید اعطا کنید: ${forbidden.join(', ')}`);
        }
      }
    }

    const roleRows = await this.prisma.role.findMany({
      where: {
        OR: [
          { name: { in: normalized, mode: 'insensitive' } },
          { displayName: { in: normalized, mode: 'insensitive' } },
        ],
      },
    });"""
if needle in st and "#r4.C2" not in st:
    st = st.replace(needle, insert, 1)
    print("C2 role grant restriction")

# H5: setUserStatus — prevent self-disable and last SUPER_ADMIN lockout
old_sus = """  async setUserStatus(id: string, status: UserStatus | string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { status: status as UserStatus } });"""
new_sus = """  async setUserStatus(id: string, status: UserStatus | string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (actorId && actorId === id && status !== UserStatus.active) {
      throw new BadRequestException('نمی‌توانید وضعیت حساب خودتان را غیرفعال کنید');
    }
    const targetIsSuper = (existing.userRoles || []).some((ur) => ur.role.name === 'SUPER_ADMIN');
    if (targetIsSuper && status !== UserStatus.active) {
      const superCount = await this.prisma.userRole.count({
        where: { role: { name: 'SUPER_ADMIN' }, user: { status: UserStatus.active } },
      });
      if (superCount <= 1) {
        throw new BadRequestException('نمی‌توان آخرین SUPER_ADMIN فعال را غیرفعال کرد');
      }
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { status: status as UserStatus } });"""
if old_sus in st:
    st = st.replace(old_sus, new_sus, 1)
    print("H5 setUserStatus guards")

svc.write_text(st, encoding="utf-8")
print("admin.service written")

# ---------------------------------------------------------------------------
# 3) RolesGuard: both Roles AND Permissions => require both (AND)
# ---------------------------------------------------------------------------
guard = Path("backend/src/common/guards/roles.guard.ts")
gt = guard.read_text(encoding="utf-8")
old_or = """    if (rolesRequired && permsRequired) {
      if (hasRole || hasPerms) return true;
      throw new ForbiddenException('دسترسی مجاز نیست: نقش یا مجوز لازم یافت نشد');
    }"""
new_and = """    if (rolesRequired && permsRequired) {
      // #r4.M9 — both declared => require BOTH (stricter)
      if (hasRole && hasPerms) return true;
      throw new ForbiddenException('دسترسی مجاز نیست: نقش و مجوز لازم یافت نشد');
    }"""
if old_or in gt:
    gt = gt.replace(old_or, new_and, 1)
    guard.write_text(gt, encoding="utf-8")
    print("M9 RolesGuard AND")
else:
    print("M9 pattern miss")

# ---------------------------------------------------------------------------
# 4) files.controller expand private denylist
# ---------------------------------------------------------------------------
fc = Path("backend/src/media/files.controller.ts")
if fc.exists():
    ft = fc.read_text(encoding="utf-8")
    if "/passport" not in ft:
        ft = ft.replace(
            "k.includes('/verification')",
            "k.includes('/verification') ||\n      k.includes('/passport') ||\n      k.includes('/nid') ||\n      k.includes('/license') ||\n      k.includes('/certificate')",
            1,
        )
        fc.write_text(ft, encoding="utf-8")
        print("M7 files denylist")

print("DONE")
