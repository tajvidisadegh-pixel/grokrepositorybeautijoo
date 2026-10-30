import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listMine(userId: string, page = 1, limit = 30) {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(limit || 30, 1), 50);
    const skip = (safePage - 1) * safeLimit;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { body: true, createdAt: true, isStaff: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastPreview: t.messages[0]?.body?.slice(0, 120) ?? null,
      })),
      meta: { page: safePage, limit: safeLimit, total },
    };
  }

  async listAll(page = 1, limit = 40, status?: string) {
    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(limit || 40, 1), 80);
    const skip = (safePage - 1) * safeLimit;
    const where: { status?: string } = {};
    if (status && status !== 'all') where.status = status;
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              accountType: true,
              profile: { select: { displayName: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { body: true, createdAt: true, isStaff: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastPreview: t.messages[0]?.body?.slice(0, 120) ?? null,
        user: {
          id: t.user.id,
          phone: t.user.phone,
          accountType: t.user.accountType,
          displayName: t.user.profile?.displayName ?? null,
        },
      })),
      meta: { page: safePage, limit: safeLimit, total },
    };
  }

  async getOne(ticketId: string, userId: string, isStaff: boolean) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            accountType: true,
            profile: { select: { displayName: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                phone: true,
                profile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    if (!isStaff && ticket.userId !== userId) {
      throw new ForbiddenException('دسترسی ندارید');
    }
    return ticket;
  }

  async createTicket(userId: string, subject: string, body: string) {
    const sub = (subject || '').trim().slice(0, 200);
    const msg = (body || '').trim();
    if (sub.length < 3) throw new ForbiddenException('موضوع حداقل ۳ کاراکتر باشد');
    if (msg.length < 2) throw new ForbiddenException('پیام حداقل ۲ کاراکتر باشد');
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject: sub,
        status: 'open',
        messages: {
          create: {
            senderId: userId,
            body: msg,
            isStaff: false,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    // Auto-ack to sender (#65.17) — in-app only, never fails the ticket create
    try {
      await this.notifications.notify({
        userId,
        type: NotificationType.system,
        title: 'پیام شما دریافت شد',
        body:
          'پیام شما با موفقیت ارسال شد. تیم پشتیبانی در اسرع وقت پیگیری می‌کند و به شما پاسخ خواهد داد. از همراهی‌تان سپاسگزاریم.',
        data: { ticketId: ticket.id, href: '/zibagar/support' },
        sms: false,
      });
    } catch {
      /* ignore */
    }

    return ticket;
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    body: string,
    isStaff: boolean,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    if (!isStaff && ticket.userId !== senderId) {
      throw new ForbiddenException('دسترسی ندارید');
    }
    const msg = (body || '').trim();
    if (msg.length < 1) throw new ForbiddenException('پیام خالی است');
    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        senderId,
        body: msg,
        isStaff,
      },
    });
    const newStatus = isStaff ? 'answered' : 'open';
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: newStatus, updatedAt: new Date() },
    });
    return message;
  }

  async setStatus(ticketId: string, status: string) {
    const allowed = ['open', 'answered', 'closed'];
    if (!allowed.includes(status)) {
      throw new ForbiddenException('وضعیت نامعتبر');
    }
    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });
    return ticket;
  }
}
