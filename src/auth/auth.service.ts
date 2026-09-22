import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';
import { AccountType, ProfessionalStatus, UserStatus } from '@prisma/client';
import { RegisterDto, LoginDto, RequestOtpDto, VerifyOtpDto, UpdateProfileDto, ChangePasswordDto, DeleteAccountDto } from './dto/auth.dto';
import { userAuthCache } from './user-auth-cache';

function ttlToMs(ttl: string | undefined, fallbackMs: number): number {
  if (!ttl) return fallbackMs;
  const m = /^(\d+)([smhd])$/i.exec(ttl.trim());
  if (!m) return fallbackMs;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult =
    unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN', 'admin']);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveAccountType(raw?: string | null): AccountType {
    if (raw === 'professional') return AccountType.professional;
    return AccountType.customer;
  }

  private isPrivileged(roles: string[]): boolean {
    return roles.some((r) => PRIVILEGED_ROLES.has(r));
  }

  private async issueTokens(userId: string, phone: string | null) {
    const payload = { sub: userId, phone: phone ?? undefined };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessTtl') || '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh', jti: randomUUID() },
      {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshTtl') || '7d',
      },
    );
    const refreshTtl = this.config.get<string>('jwt.refreshTtl') || '7d';
    const expiresAt = new Date(Date.now() + ttlToMs(refreshTtl, 7 * 86_400_000));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const rawRole = dto.role;
    if (rawRole === undefined || rawRole === null || rawRole === 'customer') {
    } else if (rawRole !== 'professional') {
      throw new BadRequestException('نقش ثبت‌نام فقط customer یا professional مجاز است');
    }

    const accountType = this.resolveAccountType(rawRole);
    const roleName = accountType === AccountType.professional ? 'professional' : 'customer';

    const existing = await this.prisma.user.findFirst({
      where: { phone: dto.phone, accountType },
    });
    if (existing) {
      const label = roleName === 'professional' ? 'زیباگر' : 'مشتری';
      throw new ConflictException(`این شماره قبلاً به‌عنوان ${label} ثبت شده است`);
    }

    const passwordHash = await argon2.hash(dto.password);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: roleName } });

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        accountType,
        phoneVerified: false,
        profile: {
          create: { displayName: dto.displayName || dto.phone },
        },
        userRoles: { create: { roleId: role.id } },
        ...(roleName === 'professional'
          ? {
              professional: {
                create: {
                  title: dto.displayName || 'زیباگر',
                  slug: `pro-${dto.phone}-${Date.now().toString(36)}`,
                  status: ProfessionalStatus.draft,
                },
              },
            }
          : {}),
      },
      include: { userRoles: { include: { role: true } } },
    });

    const tokens = await this.issueTokens(user.id, user.phone);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        roles: user.userRoles.map((r) => r.role.name),
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const accountType = this.resolveAccountType(dto.accountType);

    let user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, accountType },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.passwordHash) {
      const candidates = await this.prisma.user.findMany({
        where: { phone: dto.phone, status: 'active' },
        include: { userRoles: { include: { role: true } } },
      });
      const privileged = candidates.find((u) =>
        u.userRoles.some((ur) => PRIVILEGED_ROLES.has(ur.role.name)),
      );
      if (privileged?.passwordHash) {
        user = privileged;
      }
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('شماره یا رمز عبور نادرست است');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('شماره یا رمز عبور نادرست است');
    if (user.status !== 'active') throw new UnauthorizedException('حساب غیرفعال است');

    const roles = user.userRoles.map((r) => r.role.name);
    const privileged = this.isPrivileged(roles);

    if (
      !privileged &&
      accountType === AccountType.professional &&
      !roles.includes('professional')
    ) {
      throw new UnauthorizedException('این حساب دسترسی پنل زیباگر ندارد');
    }
    if (!privileged && accountType === AccountType.customer && !roles.includes('customer')) {
      throw new UnauthorizedException('این حساب دسترسی پنل مشتری ندارد');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.phone);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        roles,
      },
      ...tokens,
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const purposeBase = dto.purpose || 'login';
    const accountType = this.resolveAccountType(dto.accountType);
    const purpose = `${purposeBase}:${accountType}`;
    const ttl = this.config.get<number>('otpTtlSeconds') || 300;
    const cooldownSec = this.config.get<number>('otpCooldownSeconds') || 60;
    const maxPerHour = this.config.get<number>('otpMaxPerHour') || 3;
    const maxPerDay = this.config.get<number>('otpMaxPerDay') || 8;
    const now = Date.now();

    const last = await this.prisma.otpCode.findFirst({
      where: { phone: dto.phone, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (last) {
      const elapsedMs = now - last.createdAt.getTime();
      if (elapsedMs < cooldownSec * 1000) {
        const waitSec = Math.ceil((cooldownSec * 1000 - elapsedMs) / 1000);
        throw new BadRequestException(
          `لطفاً ${waitSec} ثانیه صبر کنید و دوباره درخواست دهید.`,
        );
      }
    }

    const hourCount = await this.prisma.otpCode.count({
      where: {
        phone: dto.phone,
        purpose,
        createdAt: { gte: new Date(now - 60 * 60 * 1000) },
      },
    });
    if (hourCount >= maxPerHour) {
      throw new BadRequestException(
        'تعداد درخواست OTP در یک ساعت بیش از حد مجاز است. کمی بعد تلاش کنید.',
      );
    }

    const dayCount = await this.prisma.otpCode.count({
      where: {
        phone: dto.phone,
        createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
      },
    });
    if (dayCount >= maxPerDay) {
      throw new BadRequestException(
        'سقف روزانه درخواست OTP برای این شماره پر شده است. فردا دوباره تلاش کنید.',
      );
    }

    await this.prisma.otpCode.updateMany({
      where: { phone: dto.phone, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(now + ttl * 1000);

    await this.prisma.otpCode.create({
      data: { phone: dto.phone, codeHash, purpose, expiresAt },
    });

    await this.sms.sendOtp(dto.phone, code);
    return { message: 'کد تأیید ارسال شد', expiresIn: ttl };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const purposeBase = dto.purpose || 'login';
    const accountType = this.resolveAccountType(dto.accountType);
    const purpose = `${purposeBase}:${accountType}`;
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');

    const maxAttempts = this.config.get<number>('otpMaxAttempts') || 3;
    if (otp.attempts >= maxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException(
        'تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.',
      );
    }

    const valid = await argon2.verify(otp.codeHash, dto.code);
    if (!valid) {
      const updated = await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= maxAttempts) {
        await this.prisma.otpCode.update({
          where: { id: otp.id },
          data: { usedAt: new Date() },
        });
        throw new UnauthorizedException(
          'تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.',
        );
      }
      throw new UnauthorizedException('کد نادرست است');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    let user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, accountType },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      if (accountType !== AccountType.customer) {
        throw new UnauthorizedException(
          'حساب زیباگر برای این شماره وجود ندارد. ابتدا به‌عنوان زیباگر ثبت‌نام کنید.',
        );
      }
      const customerRole = await this.prisma.role.findUniqueOrThrow({
        where: { name: 'customer' },
      });
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          accountType: AccountType.customer,
          phoneVerified: true,
          profile: { create: { displayName: dto.phone } },
          userRoles: { create: { roleId: customerRole.id } },
        },
        include: { userRoles: { include: { role: true } } },
      });
    } else if (!user.phoneVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true, lastLoginAt: new Date() },
        include: { userRoles: { include: { role: true } } },
      });
    }

    if (user.status !== 'active') throw new UnauthorizedException('حساب غیرفعال است');

    const tokens = await this.issueTokens(user.id, user.phone);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        roles: user.userRoles.map((r) => r.role.name),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('توکن نامعتبر است');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException();

    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored) {
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }
    // Reuse detection: revoked token replay → revoke entire family (theft signal)
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      userAuthCache.invalidate(stored.userId);
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: stored.userId,
            action: 'auth.refresh_reuse_detected',
            entityType: 'user',
            entityId: stored.userId,
            after: { reason: 'revoked_token_replay' },
          },
        });
      } catch {
        /* best-effort audit */
      }
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();

    return this.issueTokens(user.id, user.phone);
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
      if (payload?.sub) userAuthCache.invalidate(payload.sub);
    } catch {
      /* ignore */
    }
    const hash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'خروج انجام شد' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      status: user.status,
      accountType: user.accountType,
      phoneVerified: user.phoneVerified,
      profile: user.profile,
      roles: user.userRoles.map((r) => r.role.name),
      professional: user.professional
        ? {
            id: user.professional.id,
            slug: user.professional.slug,
            status: user.professional.status,
            title: user.professional.title,
          }
        : null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException();

    if (dto.email !== undefined && dto.email !== null && dto.email !== '') {
      const email = String(dto.email).trim().toLowerCase();
      if (email !== (user.email || '').toLowerCase()) {
        const taken = await this.prisma.user.findFirst({
          where: { email, NOT: { id: userId } },
          select: { id: true },
        });
        if (taken) throw new ConflictException('این ایمیل قبلاً ثبت شده است');
      }
    }

    const profileData: {
      displayName?: string;
      firstName?: string | null;
      lastName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};
    if (dto.displayName !== undefined) {
      const name = String(dto.displayName).trim();
      if (!name) throw new BadRequestException('نام نمایشی نمی‌تواند خالی باشد');
      profileData.displayName = name.slice(0, 120);
    }
    if (dto.firstName !== undefined) {
      profileData.firstName = dto.firstName ? String(dto.firstName).trim().slice(0, 80) : null;
    }
    if (dto.lastName !== undefined) {
      profileData.lastName = dto.lastName ? String(dto.lastName).trim().slice(0, 80) : null;
    }
    if (dto.bio !== undefined) {
      profileData.bio = dto.bio ? String(dto.bio).trim().slice(0, 2000) : null;
    }
    if (dto.avatarUrl !== undefined) {
      profileData.avatarUrl = dto.avatarUrl ? String(dto.avatarUrl).trim().slice(0, 512) : null;
    }

    const emailUpdate =
      dto.email !== undefined
        ? dto.email
          ? String(dto.email).trim().toLowerCase()
          : null
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (emailUpdate !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { email: emailUpdate },
        });
      }
      if (Object.keys(profileData).length > 0) {
        if (user.profile) {
          await tx.profile.update({
            where: { userId },
            data: profileData,
          });
        } else {
          await tx.profile.create({
            data: {
              userId,
              displayName:
                profileData.displayName ||
                user.phone ||
                'کاربر',
              firstName: profileData.firstName ?? null,
              lastName: profileData.lastName ?? null,
              bio: profileData.bio ?? null,
              avatarUrl: profileData.avatarUrl ?? null,
            },
          });
        }
      }
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.profile_update',
            entityType: 'user',
            entityId: userId,
            before: {
              email: user.email,
              profile: user.profile
                ? {
                    displayName: user.profile.displayName,
                    firstName: user.profile.firstName,
                    lastName: user.profile.lastName,
                    bio: user.profile.bio,
                    avatarUrl: user.profile.avatarUrl,
                  }
                : null,
            } as any,
            after: { email: emailUpdate, ...profileData } as any,
          },
        });
      } catch {
        /* non-blocking */
      }
    });

    userAuthCache.invalidate(userId);
    return this.me(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('امکان تغییر رمز برای این حساب وجود ندارد');
    }
    const ok = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!ok) {
      throw new UnauthorizedException('رمز فعلی اشتباه است');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('رمز جدید باید با رمز فعلی متفاوت باشد');
    }
    if (dto.newPassword.length < 8) {
      throw new BadRequestException('رمز جدید باید حداقل ۸ کاراکتر باشد');
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.password_change',
            entityType: 'user',
            entityId: userId,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.' };
  }

  async listSessions(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return tokens.map((t) => ({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException('نشست یافت نشد یا قبلاً لغو شده است');
    }
    return { message: 'نشست با موفقیت لغو شد' };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    userAuthCache.invalidate(userId);
    return { message: 'همه نشست‌ها لغو شدند. لطفاً دوباره وارد شوید.' };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, professional: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.status === UserStatus.deleted) {
      throw new BadRequestException('این حساب قبلاً حذف شده است');
    }
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('رمز عبور برای تأیید حذف الزامی است');
      }
      const ok = await argon2.verify(user.passwordHash, dto.password);
      if (!ok) {
        throw new UnauthorizedException('رمز عبور اشتباه است');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.deleted,
          phone: null,
          email: null,
          passwordHash: null,
          phoneVerified: false,
          emailVerified: false,
        },
      });
      if (user.profile) {
        await tx.profile.update({
          where: { userId },
          data: {
            displayName: 'کاربر حذف‌شده',
            firstName: null,
            lastName: null,
            bio: null,
            avatarUrl: null,
            birthDate: null,
            gender: 'undisclosed',
          },
        });
      }
      if (user.professional) {
        await tx.professional.update({
          where: { userId },
          data: {
            status: ProfessionalStatus.suspended,
            publishedAt: null,
            isFeatured: false,
          },
        });
      }
      await tx.booking.updateMany({
        where: {
          customerId: userId,
          status: { in: ['pending', 'confirmed'] },
        },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'account_deleted',
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.account_delete',
            entityType: 'user',
            entityId: userId,
            after: { anonymized: true, status: 'deleted' } as any,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'حساب کاربری با موفقیت حذف و داده‌های شخصی ناشناس شد' };
  }
}
