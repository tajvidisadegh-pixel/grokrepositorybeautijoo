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

  /** Reviews received by the logged-in professional */
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
    return {
      items,
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

  /** Professional replies to a review on their profile (#9) */
  async replyAsProfessional(userId: string, reviewId: string, reply: string) {
    const text = (reply || '').trim();
    if (text.length < 2) throw new BadRequestException('پاسخ باید حداقل ۲ کاراکتر باشد');
    if (text.length > 2000) throw new BadRequestException('پاسخ بیش از حد طولانی است');

    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');

    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('نظر یافت نشد');
    if (review.professionalId !== pro.id) throw new ForbiddenException('این نظر متعلق به شما نیست');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        professionalReply: text,
        repliedAt: new Date(),
      },
    });
  }
}
