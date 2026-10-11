import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        professional: {
          include: {
            user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
      },
    });
  }

  async listWithPros(userId: string) {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        professional: {
          include: {
            user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
      },
    });
    return favs.filter(
      (f) => f.professional && f.professional.status === 'approved',
    );
  }

  async add(userId: string, professionalId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');
    try {
      return await this.prisma.favorite.create({
        data: { userId, professionalId },
      });
    } catch {
      throw new ConflictException('قبلاً در علاقه‌مندی‌هاست');
    }
  }

  async remove(userId: string, professionalId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, professionalId } });
    return { message: 'حذف شد' };
  }
}
