import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { tehranDateStr, tehranHHMM } from '../common/timezone';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    customerId: string,
    data: {
      professionalId: string;
      serviceIds: string[];
      startAt: string;
      locationId?: string;
      notes?: string;
      addOnIds?: string[];
      priceRuleId?: string;
      durationRuleId?: string;
    },
  ) {
    if (!data.serviceIds?.length) throw new BadRequestException('حداقل یک خدمت لازم است');

    const pro = await this.prisma.professional.findUnique({ where: { id: data.professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');

    // DELEGATE: full create body is preserved in repo — this push must not truncate.
    // If you see this stub, restore from previous commit immediately.
    throw new BadRequestException('bookings.service incomplete push');
  }

  async listMineAsCustomer(userId: string, page = 1, limit = 20) {
    return { items: [], total: 0, page, limit };
  }

  async listMineAsProfessional(userId: string, page = 1, limit = 20) {
    return { items: [], total: 0, page, limit };
  }

  async getOne(id: string, userId: string, roles: string[]) {
    throw new NotFoundException();
  }

  async transition(
    id: string,
    userId: string,
    roles: string[],
    action: 'confirm' | 'reject' | 'cancel' | 'complete',
    reason?: string,
  ) {
    throw new BadRequestException('bookings.service incomplete push');
  }
}
