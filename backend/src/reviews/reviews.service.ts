import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, page = 1, limit = 20) {
    const take = Math.min(50, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const where = { customerId: userId };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: {
            select: {
              id: true,
              slug: true,
              title: true,
              user: { select: { profile: { select: { displayName: true } } } },
            },
          },
          booking: {
            select: { id: true, startAt: true, status: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items,
      meta: { page: Math.max(1, page), limit: take, total, totalPages: Math.ceil(total / take) || 0 },
    };
  }

  async listForProfessional(userId: string, page = 1, limit = 20) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const take = Math.min(50, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const where = { professionalId: pro.id };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
          booking: {
            select: { id: true, startAt: true, status: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const ids = items.map((i) => i.id);
    const replyMap = new Map<string, { professionalReply: string | null; repliedAt: Date | null }>();
    if (ids.length) {
      try {
        const rows = await this.prisma.$queryRawUnsafe<
          Array<{ id: string; professional_reply: string | null; replied_at: Date | null }>
        >(
          `SELECT id, professional_reply, replied_at FROM reviews WHERE id = ANY($1::uuid[])`,
          ids,
        );
        for (const r of rows) {
          replyMap.set(r.id, {
            professionalReply: r.professional_reply,
            repliedAt: r.replied_at,
          });
        }
      } catch {
        /* column may not exist yet */
      }
    }

    const enriched = items.map((i) => ({
      ...i,
      professionalReply: replyMap.get(i.id)?.professionalReply ?? null,
      repliedAt: replyMap.get(i.id)?.repliedAt ?? null,
    }));

    return {
      items: enriched,
      meta: { page: Math.max(1, page), limit: take, total, totalPages: Math.ceil(total / take) || 0 },
      summary: {
        ratingAvg: pro.ratingAvg,
        ratingCount: pro.ratingCount,
      },
    };
  }

  async create(userId: string, data: { bookingId: string; rating: number; comment?: string }) {
    if (data.rating < 1 || data.rating > 5) throw new BadRequestException('امتیاز باید ۱ تا ۵ باشد');
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { review: true },
    });
    if (!booking) throw new NotFoundException();
    if (booking.customerId !== userId) throw new ForbiddenException();
    if (booking.status !== 'completed') throw new BadRequestException('فقط پس از تکمیل نوبت می‌توانید نظر دهید');
    if (booking.review) throw new ConflictException('قبلاً نظر ثبت شده است');

    const review = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          bookingId: data.bookingId,
          customerId: userId,
          professionalId: booking.professionalId,
          rating: data.rating,
          comment: data.comment,
        },
      });
      const agg = await tx.review.aggregate({
        where: { professionalId: booking.professionalId, isPublished: true },
        _avg: { rating: true },
        _count: true,
      });
      await tx.professional.update({
        where: { id: booking.professionalId },
        data: {
          ratingAvg: agg._avg.rating || 0,
          ratingCount: agg._count,
        },
      });
      return r;
    });
    return review;
  }

  async replyAsProfessional(userId: string, reviewId: string, reply: string) {
    const text = (reply || '').trim();
    if (text.length < 2) throw new BadRequestException('پاسخ باید حداقل ۲ کاراکتر باشد');
    if (text.length > 2000) throw new BadRequestException('پاسخ بیش از حد طولانی است');

    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');

    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('نظر یافت نشد');
    if (review.professionalId !== pro.id) throw new ForbiddenException('این نظر متعلق به شما نیست');

    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE reviews SET professional_reply = $1, replied_at = NOW(), updated_at = NOW() WHERE id = $2::uuid`,
        text,
        reviewId,
      );
    } catch {
      throw new BadRequestException('ستون پاسخ نظر در دیتابیس موجود نیست. migration را اجرا کنید.');
    }

    return {
      id: reviewId,
      professionalReply: text,
      repliedAt: new Date().toISOString(),
    };
  }
}
