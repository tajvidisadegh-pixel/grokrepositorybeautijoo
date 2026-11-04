import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['pending', 'quoted', 'declined', 'cancelled', 'expired'] as const;
export type QuoteStatus = (typeof STATUSES)[number];

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, data: {
    professionalId: string;
    professionalServiceId?: string;
    note?: string;
    photoUrls?: string[];
  }) {
    const pro = await this.prisma.professional.findFirst({
      where: {
        id: data.professionalId,
        status: { not: 'draft' },
      },
    });
    if (!pro) throw new NotFoundException('زیباگر یافت نشد');

    if (data.professionalServiceId) {
      const ps = await this.prisma.professionalService.findFirst({
        where: {
          id: data.professionalServiceId,
          professionalId: data.professionalId,
          isActive: true,
        },
      });
      if (!ps) throw new BadRequestException('خدمت انتخاب‌شده معتبر نیست');
    }

    const urls = (data.photoUrls || [])
      .filter((u) => typeof u === 'string' && u.trim().length > 0)
      .map((u) => u.trim())
      .slice(0, 5);

    return this.prisma.priceQuoteRequest.create({
      data: {
        customerId,
        professionalId: data.professionalId,
        professionalServiceId: data.professionalServiceId || null,
        note: data.note?.trim() || null,
        photoUrls: urls,
        status: 'pending',
      },
      include: this.include(),
    });
  }

  async listMineAsCustomer(customerId: string) {
    return this.prisma.priceQuoteRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: this.include(),
    });
  }

  async listMineAsPro(userId: string) {
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    if (!pro) throw new ForbiddenException('حساب زیباگر یافت نشد');
    return this.prisma.priceQuoteRequest.findMany({
      where: { professionalId: pro.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: this.include(),
    });
  }

  async respond(
    userId: string,
    quoteId: string,
    body: {
      status: 'quoted' | 'declined';
      quotedPrice?: number;
      quotedDurationMin?: number;
      responseNote?: string;
    },
  ) {
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    if (!pro) throw new ForbiddenException('حساب زیباگر یافت نشد');

    const row = await this.prisma.priceQuoteRequest.findUnique({ where: { id: quoteId } });
    if (!row || row.professionalId !== pro.id) throw new NotFoundException('درخواست یافت نشد');
    if (row.status !== 'pending') throw new BadRequestException('این درخواست قبلاً پاسخ داده شده');

    if (body.status === 'quoted') {
      if (body.quotedPrice == null || body.quotedPrice < 0) {
        throw new BadRequestException('مبلغ پیشنهادی الزامی است');
      }
    }

    return this.prisma.priceQuoteRequest.update({
      where: { id: quoteId },
      data: {
        status: body.status,
        quotedPrice: body.status === 'quoted' ? body.quotedPrice : null,
        quotedDurationMin: body.status === 'quoted' ? body.quotedDurationMin ?? null : null,
        responseNote: body.responseNote?.trim() || null,
        respondedAt: new Date(),
      },
      include: this.include(),
    });
  }

  async cancelAsCustomer(customerId: string, quoteId: string) {
    const row = await this.prisma.priceQuoteRequest.findUnique({ where: { id: quoteId } });
    if (!row || row.customerId !== customerId) throw new NotFoundException('درخواست یافت نشد');
    if (row.status !== 'pending') throw new BadRequestException('فقط درخواست در انتظار قابل لغو است');
    return this.prisma.priceQuoteRequest.update({
      where: { id: quoteId },
      data: { status: 'cancelled' },
      include: this.include(),
    });
  }

  private include() {
    return {
      professional: { select: { id: true, slug: true, title: true } },
      professionalService: {
        select: {
          id: true,
          price: true,
          durationMin: true,
          service: { select: { id: true, name: true } },
        },
      },
      customer: {
        select: {
          id: true,
          profile: { select: { displayName: true } },
        },
      },
    } as const;
  }
}
