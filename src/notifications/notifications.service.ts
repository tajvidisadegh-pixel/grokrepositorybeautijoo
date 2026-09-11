import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, type SmsProvider } from '../sms/sms.provider';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** When true, also send SMS to the user's phone (best-effort). */
  sms?: boolean;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  list(userId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { message: 'ok' };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /**
   * Persist in-app notification and optionally SMS.
   * Never throws to callers — booking flows must not fail on notify errors.
   */
  async notify(input: CreateNotificationInput): Promise<{ id?: string } | null> {
    try {
      const row = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      if (input.sms) {
        await this.sendSmsSafe(input.userId, input.body);
      }

      return { id: row.id };
    } catch (err) {
      this.logger.warn(
        `notify failed user=${input.userId} type=${input.type}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  private async sendSmsSafe(userId: string, message: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      const phone = user?.phone?.trim();
      if (!phone) return;
      await this.sms.sendNotification(phone, message);
    } catch (err) {
      this.logger.warn(`SMS failed user=${userId}: ${(err as Error)?.message}`);
    }
  }
}
