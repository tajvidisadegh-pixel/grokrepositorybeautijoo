#!/usr/bin/env python3
"""Fix admin professional approve/publish/notify/detail."""
from pathlib import Path

svc = Path('backend/src/admin/admin.service.ts')
st = svc.read_text()

# Add NotificationType import
if 'NotificationType' not in st.split('from \'@prisma/client\'')[0]:
    st = st.replace(
        '''import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaStatus,
  Prisma,
} from '@prisma/client';''',
        '''import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';''',
        1,
    )

old_detail = '''  async getProfessionalDetail(id: string) {
    const p = await this.prisma.professional.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, professionalServices: true },
    });
    if (!p) throw new NotFoundException('Professional not found');
    return p;
  }'''

new_detail = '''  async getProfessionalDetail(id: string) {
    const p = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        professionalServices: {
          include: {
            service: { include: { category: true } },
          },
        },
        locations: {
          include: { location: true },
          orderBy: { isPrimary: 'desc' },
        },
        mediaAssets: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] },
        bookings: {
          take: 20,
          orderBy: { startAt: 'desc' },
          include: {
            customer: { include: { profile: true } },
            payment: true,
          },
        },
        reviews: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { include: { profile: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Professional not found');

    const primaryCity =
      p.locations?.find((l) => l.isPrimary)?.location?.city ||
      p.locations?.[0]?.location?.city ||
      null;

    const [bookingTotal, bookingCompleted, bookingCancelled, bookingPending, mediaCount, serviceCount] =
      await Promise.all([
        this.prisma.booking.count({ where: { professionalId: id } }),
        this.prisma.booking.count({ where: { professionalId: id, status: BookingStatus.completed } }),
        this.prisma.booking.count({ where: { professionalId: id, status: BookingStatus.cancelled } }),
        this.prisma.booking.count({ where: { professionalId: id, status: BookingStatus.pending } }),
        this.prisma.mediaAsset.count({ where: { professionalId: id } }),
        this.prisma.professionalService.count({ where: { professionalId: id, isActive: true } }),
      ]);

    const revenueAgg = await this.prisma.payment.aggregate({
      where: { status: PaymentStatus.paid, booking: { professionalId: id } },
      _sum: { professionalNetAmount: true, amount: true },
    });

    return {
      ...p,
      city: primaryCity,
      mediaAssets: (p.mediaAssets || []).map((m) => ({
        ...m,
        publicUrl: m.url,
      })),
      stats: {
        total: bookingTotal,
        successful: bookingCompleted,
        cancelled: bookingCancelled,
        pending: bookingPending,
        revenue: Number(revenueAgg._sum.professionalNetAmount || revenueAgg._sum.amount || 0),
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        reviewCount: p.reviews?.length ?? 0,
        serviceCount,
        mediaCount,
      },
    };
  }'''

if old_detail in st:
    st = st.replace(old_detail, new_detail, 1)
    print('detail fixed')
else:
    print('detail pattern miss')

old_status = '''  async setProfessionalStatus(id: string, status: ProfessionalStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');
    const updated = await this.prisma.professional.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'professional.status_change', 'professional', id, { status: existing.status }, { status, reason });
    return updated;
  }'''

new_status = '''  async setProfessionalStatus(id: string, status: ProfessionalStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');

    const data: Prisma.ProfessionalUpdateInput = { status };

    // Public catalog requires status=approved AND publishedAt != null
    if (status === ProfessionalStatus.approved) {
      data.publishedAt = existing.publishedAt || new Date();
      data.verifiedAt = existing.verifiedAt || new Date();
    } else if (
      status === ProfessionalStatus.rejected ||
      status === ProfessionalStatus.suspended ||
      status === ProfessionalStatus.draft
    ) {
      data.publishedAt = null;
    }

    const updated = await this.prisma.professional.update({ where: { id }, data });

    // On approve, publish draft portfolio media so it becomes visible
    if (status === ProfessionalStatus.approved) {
      await this.prisma.mediaAsset
        .updateMany({
          where: { professionalId: id, status: MediaStatus.draft },
          data: { status: MediaStatus.published },
        })
        .catch(() => undefined);
    }

    // In-app notification for the professional
    try {
      let title = 'به‌روزرسانی وضعیت پروفایل';
      let body = `وضعیت پروفایل شما به «${status}» تغییر کرد.`;
      if (status === ProfessionalStatus.approved) {
        title = 'پروفایل شما تأیید شد';
        body =
          'تبریک! پروفایل زیباگری شما توسط مدیریت تأیید و منتشر شد. از این پس در نتایج جستجو نمایش داده می‌شوید.';
      } else if (status === ProfessionalStatus.rejected) {
        title = 'پروفایل شما رد شد';
        body =
          (reason && String(reason).trim()) ||
          'پروفایل شما توسط مدیریت رد شد. لطفاً اطلاعات را تکمیل و دوباره ارسال کنید.';
      } else if (status === ProfessionalStatus.suspended) {
        title = 'پروفایل شما تعلیق شد';
        body =
          (reason && String(reason).trim()) ||
          'پروفایل شما موقتاً تعلیق شده است. برای جزئیات با پشتیبانی تماس بگیرید.';
      }
      await this.prisma.notification.create({
        data: {
          userId: existing.userId,
          type: NotificationType.system,
          title,
          body,
          data: { professionalId: id, status, reason: reason || null } as any,
        },
      });
    } catch (e) {
      this.logger.warn(`notify professional status failed: ${(e as Error)?.message || e}`);
    }

    await this.audit(
      actorId,
      'professional.status_change',
      'professional',
      id,
      { status: existing.status, publishedAt: existing.publishedAt },
      { status, publishedAt: updated.publishedAt, reason },
    );
    return updated;
  }'''

if old_status in st:
    st = st.replace(old_status, new_status, 1)
    print('status fixed')
else:
    print('status pattern miss')

svc.write_text(st)
print('OK braces', st.count('{'), st.count('}'))
