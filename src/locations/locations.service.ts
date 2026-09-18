import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';

type LocationInput = {
  name?: string;
  address?: string;
  city: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
  precision?: 'exact' | 'approximate';
};

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  private normalizeCoords(data: LocationInput) {
    const precision =
      data.precision ||
      (data.latitude != null && data.longitude != null ? 'exact' : 'approximate');
    let latitude = data.latitude != null ? Number(data.latitude) : null;
    let longitude = data.longitude != null ? Number(data.longitude) : null;
    if (latitude != null && (latitude < -90 || latitude > 90)) {
      throw new BadRequestException('عرض جغرافیایی نامعتبر است');
    }
    if (longitude != null && (longitude < -180 || longitude > 180)) {
      throw new BadRequestException('طول جغرافیایی نامعتبر است');
    }
    if (precision === 'approximate') {
      if (latitude != null) latitude = Math.round(latitude * 100) / 100;
      if (longitude != null) longitude = Math.round(longitude * 100) / 100;
    }
    return { precision, latitude, longitude };
  }

  private buildAddress(data: LocationInput, precision: string) {
    const base = (data.address?.trim() || '').trim();
    if (precision === 'approximate' && !base) {
      return `محدوده ${data.city}${data.province ? `، ${data.province}` : ''}`;
    }
    if (precision === 'approximate' && base && !base.includes('محدوده')) {
      return `${base} (محدوده تقریبی)`;
    }
    return base || `${data.province || ''} ${data.city}`.trim();
  }

  private toClientRow(row: {
    isPrimary: boolean;
    location: {
      id: string;
      name: string | null;
      address: string;
      city: string;
      province: string | null;
      latitude: unknown;
      longitude: unknown;
    };
  }) {
    const lat = row.location.latitude != null ? Number(row.location.latitude) : null;
    const lng = row.location.longitude != null ? Number(row.location.longitude) : null;
    return {
      id: row.location.id,
      name: row.location.name || row.location.city,
      address: row.location.address,
      city: row.location.city,
      province: row.location.province,
      latitude: Number.isFinite(lat as number) ? lat : null,
      longitude: Number.isFinite(lng as number) ? lng : null,
      isPrimary: row.isPrimary,
    };
  }

  async listMine(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const rows = await this.prisma.professionalLocation.findMany({
      where: { professionalId: pro.id },
      include: { location: true },
      orderBy: [{ isPrimary: 'desc' }, { location: { createdAt: 'asc' } }],
    });
    return rows.map((r) => this.toClientRow(r));
  }

  async createLocation(userId: string, data: LocationInput) {
    if (!data.city?.trim()) throw new BadRequestException('شهر الزامی است');
    const pro = await this.professionals.requireOwnProfessional(userId);
    const { precision, latitude, longitude } = this.normalizeCoords(data);
    const name = data.name?.trim() || data.city.trim();
    const address = this.buildAddress(data, precision);

    const existingCount = await this.prisma.professionalLocation.count({
      where: { professionalId: pro.id },
    });
    const makePrimary = data.isPrimary === true || existingCount === 0;

    if (makePrimary) {
      await this.prisma.professionalLocation.updateMany({
        where: { professionalId: pro.id },
        data: { isPrimary: false },
      });
    }

    const location = await this.prisma.location.create({
      data: {
        name,
        address,
        city: data.city.trim(),
        province: data.province?.trim() || null,
        latitude,
        longitude,
      },
    });
    const row = await this.prisma.professionalLocation.create({
      data: {
        professionalId: pro.id,
        locationId: location.id,
        isPrimary: makePrimary,
      },
      include: { location: true },
    });
    return this.toClientRow(row);
  }

  async addOrUpdatePrimary(userId: string, data: LocationInput) {
    if (!data.city?.trim()) throw new BadRequestException('شهر الزامی است');
    const pro = await this.professionals.requireOwnProfessional(userId);
    const { precision, latitude, longitude } = this.normalizeCoords(data);
    const name = data.name?.trim() || data.city.trim();
    const address = this.buildAddress(data, precision);

    const primary = await this.prisma.professionalLocation.findFirst({
      where: { professionalId: pro.id, isPrimary: true },
      include: { location: true },
    });

    if (primary) {
      await this.prisma.location.update({
        where: { id: primary.locationId },
        data: {
          name: data.name?.trim() || primary.location.name,
          address,
          city: data.city.trim(),
          province: data.province || null,
          latitude,
          longitude,
        },
      });
      const row = await this.prisma.professionalLocation.findUnique({
        where: {
          professionalId_locationId: {
            professionalId: pro.id,
            locationId: primary.locationId,
          },
        },
        include: { location: true },
      });
      return row ? this.toClientRow(row) : null;
    }

    return this.createLocation(userId, { ...data, isPrimary: true });
  }

  async updateLocation(userId: string, locationId: string, data: LocationInput) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const row = await this.prisma.professionalLocation.findFirst({
      where: { locationId, professionalId: pro.id },
      include: { location: true },
    });
    if (!row) throw new NotFoundException('مکان یافت نشد');
    if (!data.city?.trim()) throw new BadRequestException('شهر الزامی است');
    const { precision, latitude, longitude } = this.normalizeCoords(data);
    const address = this.buildAddress(data, precision);
    await this.prisma.location.update({
      where: { id: row.locationId },
      data: {
        name: data.name?.trim() ?? row.location.name,
        address,
        city: data.city.trim(),
        province: data.province !== undefined ? data.province || null : row.location.province,
        latitude,
        longitude,
      },
    });
    if (data.isPrimary) {
      await this.prisma.professionalLocation.updateMany({
        where: { professionalId: pro.id },
        data: { isPrimary: false },
      });
      await this.prisma.professionalLocation.update({
        where: {
          professionalId_locationId: {
            professionalId: pro.id,
            locationId: row.locationId,
          },
        },
        data: { isPrimary: true },
      });
    }
    const updated = await this.prisma.professionalLocation.findUnique({
      where: {
        professionalId_locationId: {
          professionalId: pro.id,
          locationId: row.locationId,
        },
      },
      include: { location: true },
    });
    return updated ? this.toClientRow(updated) : null;
  }

  async deleteLocation(userId: string, locationId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const row = await this.prisma.professionalLocation.findFirst({
      where: { locationId, professionalId: pro.id },
    });
    if (!row) throw new NotFoundException('مکان یافت نشد');

    const bookingCount = await this.prisma.booking.count({
      where: { locationId },
    });
    if (bookingCount > 0) {
      await this.prisma.professionalLocation.delete({
        where: {
          professionalId_locationId: {
            professionalId: pro.id,
            locationId,
          },
        },
      });
    } else {
      await this.prisma.professionalLocation.delete({
        where: {
          professionalId_locationId: {
            professionalId: pro.id,
            locationId,
          },
        },
      });
      await this.prisma.location.delete({ where: { id: locationId } }).catch(() => undefined);
    }

    if (row.isPrimary) {
      const next = await this.prisma.professionalLocation.findFirst({
        where: { professionalId: pro.id },
        orderBy: { location: { createdAt: 'asc' } },
      });
      if (next) {
        await this.prisma.professionalLocation.update({
          where: {
            professionalId_locationId: {
              professionalId: pro.id,
              locationId: next.locationId,
            },
          },
          data: { isPrimary: true },
        });
      }
    }
    return { ok: true };
  }

  async setWorkingHours(
    userId: string,
    data: {
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      breaks?: { startTime: string; endTime: string }[];
      isActive?: boolean;
    },
  ) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const isActive = data.isActive !== false;
    const existing = await this.prisma.workingHour.findFirst({
      where: {
        professionalId: pro.id,
        dayOfWeek: data.dayOfWeek as never,
        startTime: data.startTime,
      },
    });
    if (existing) {
      await this.prisma.workingHourBreak.deleteMany({ where: { workingHourId: existing.id } });
      return this.prisma.workingHour.update({
        where: { id: existing.id },
        data: {
          endTime: data.endTime,
          isActive,
          breaks: {
            create: (data.breaks || []).map((b) => ({
              startTime: b.startTime,
              endTime: b.endTime,
            })),
          },
        },
        include: { breaks: true },
      });
    }
    return this.prisma.workingHour.create({
      data: {
        professionalId: pro.id,
        dayOfWeek: data.dayOfWeek as never,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive,
        breaks: {
          create: (data.breaks || []).map((b) => ({
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        },
      },
      include: { breaks: true },
    });
  }

  async listWorkingHours(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.workingHour.findMany({
      where: { professionalId: pro.id },
      include: { breaks: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async listTimeOff(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.timeOff.findMany({
      where: { professionalId: pro.id },
      orderBy: { startAt: 'asc' },
    });
  }

  async addTimeOff(userId: string, data: { startAt: string; endAt: string; reason?: string }) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (!(startAt.getTime() < endAt.getTime())) {
      throw new BadRequestException('بازه زمانی نامعتبر است');
    }
    return this.prisma.timeOff.create({
      data: {
        professionalId: pro.id,
        startAt,
        endAt,
        reason: data.reason,
      },
    });
  }

  async removeTimeOff(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const row = await this.prisma.timeOff.findFirst({
      where: { id, professionalId: pro.id },
    });
    if (!row) throw new NotFoundException('بازه مسدود یافت نشد');
    await this.prisma.timeOff.delete({ where: { id } });
    return { ok: true };
  }
}
