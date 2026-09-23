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
import { RegisterDto, LoginDto, RequestOtpDto, VerifyOtpDto, UpdateProfileDto, ChangePasswordDto, DeleteAccountDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { userAuthCache } from './user-auth-cache';
import { runForgotPassword, runResetPassword } from './password-reset.helpers';

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
      include: { profile: true },
    });

    const tokens = await this.issueTokens(user.id, user.phone);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        accountType: user.accountType,
        displayName: user.profile?.displayName,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const accountType = this.resolveAccountType(dto.accountType);
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, accountType },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('شماره یا رمز عبور نادرست است');
    }
    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException('حساب کاربری غیرفعال است');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('شماره یا رمز عبور نادرست است');
    }
    const tokens = await this.issueTokens(user.id, user.phone);
    const roles = user.userRoles.map((ur) => ur.role.name);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        accountType: user.accountType,
        displayName: user.profile?.displayName,
        roles,
      },
      ...tokens,
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const accountType = this.resolveAccountType(dto.accountType);
    const purposeBase = dto.purpose || 'login';
    const purpose = `${purposeBase}:${accountType}`;
    const ttl = this.config.get<number>('otpTtlSeconds') || 300;
    const cooldown = this.config.get<number>('otpCooldownSeconds') || 60;
    const maxPerHour = this.config.get<number>('otpMaxPerHour') || 5;
    const maxPerDay = this.config.get<number>('otpMaxPerDay') || 10;

    const recent = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        purpose,
        createdAt: { gt: new Date(Date.now() - cooldown * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      const wait = Math.ceil(
        (recent.createdAt.getTime() + cooldown * 1000 - Date.now()) / 1000,
      );
      throw new BadRequestException(`لطفاً ${wait} ثانیه صبر کنید و دوباره تلاش کنید`);
    }

    const hourAgo = new Date(Date.now() - 3600_000);
    const dayAgo = new Date(Date.now() - 86_400_000);
    const [hourly, daily] = await Promise.all([
      this.prisma.otpCode.count({
        where: { phone: dto.phone, purpose, createdAt: { gt: hourAgo } },
      }),
      this.prisma.otpCode.count({
        where: { phone: dto.phone, purpose, createdAt: { gt: dayAgo } },
      }),
    ]);
    if (hourly >= maxPerHour) {
      throw new BadRequestException('تعداد درخواست کد در این ساعت بیش از حد مجاز است');
    }
    if (daily >= maxPerDay) {
      throw new BadRequestException('تعداد درخواست کد در امروز بیش از حد مجاز است');
    }

    const code = String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);
    await this.prisma.otpCode.create({
      data: {
        phone: dto.phone,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    await this.sms.sendOtp(dto.phone, code);

    return {
      message: 'کد تأیید ارسال شد',
      expiresIn: ttl,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const accountType = this.resolveAccountType(dto.accountType);
    const purposeBase = dto.purpose || 'login';
    const purpose = `${purposeBase}:${accountType}`;
    const maxAttempts = this.config.get<number>('otpMaxAttempts') || 3;

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');
    }
    if (otp.attempts >= maxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException('تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.');
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
        throw new UnauthorizedException('تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.');
      }
      throw new UnauthorizedException('کد نادرست است');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    let user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, accountType },
      include: { profile: true, userRoles: { include: { role: true } } },
    });

    if (!user) {
      const roleName = accountType === AccountType.professional ? 'professional' : 'customer';
      const role = await this.prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          accountType,
          phoneVerified: true,
          profile: { create: { displayName: dto.phone } },
          userRoles: { create: { roleId: role.id } },
          ...(roleName === 'professional'
            ? {
                professional: {
                  create: {
                    title: 'زیباگر',
                    slug: `pro-${dto.phone}-${Date.now().toString(36)}`,
                    status: ProfessionalStatus.draft,
                  },
                },
              }
            : {}),
        },
        include: { profile: true, userRoles: { include: { role: true } } },
      });
    } else {
      if (user.status !== UserStatus.active) {
        throw new UnauthorizedException('حساب کاربری غیرفعال است');
      }
      if (!user.phoneVerified) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { phoneVerified: true },
        });
      }
    }

    const tokens = await this.issueTokens(user.id, user.phone);
    const roles = user.userRoles.map((ur) => ur.role.name);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        accountType: user.accountType,
        displayName: user.profile?.displayName,
        roles,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored || stored.user.status !== UserStatus.active) {
      throw new UnauthorizedException('نشست نامعتبر است');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.userId, stored.user.phone);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'خروج موفق' };
  }


  async recordImpersonationEnd(adminId: string, customerId: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'IMPERSONATION_ENDED',
          entityType: 'user',
          entityId: customerId,
          after: { customerUserId: customerId },
        },
      });
    } catch {
      /* non-blocking */
    }
    return { ok: true };
  }

  async issueImpersonationAccessToken(
    customerId: string,
    customerPhone: string | null,
    adminId: string,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const accessTtl = this.config.get<string>('jwt.accessTtl') || '30m';
    const accessToken = await this.jwt.signAsync(
      {
        sub: customerId,
        phone: customerPhone ?? undefined,
        imp: adminId,
        impMode: true,
      },
      {
        secret: this.config.get('jwt.accessSecret'),
        expiresIn: accessTtl as any,
      },
    );
    return { accessToken, expiresIn: accessTtl };
  }

  async me(
    userId: string,
    opts?: { isImpersonating?: boolean; impersonatorId?: string | null },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: { select: { id: true, status: true, title: true, slug: true } },
      },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      accountType: user.accountType,
      phoneVerified: user.phoneVerified,
      displayName: user.profile?.displayName,
      avatarUrl: user.profile?.avatarUrl,
      roles: user.userRoles.map((ur) => ur.role.name),
      professional: user.professional,
      isImpersonating: opts?.isImpersonating || false,
      impersonatorId: opts?.impersonatorId || null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profileData: Record<string, unknown> = {};
    if (dto.displayName !== undefined) profileData.displayName = dto.displayName;
    if (dto.avatarUrl !== undefined) profileData.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) profileData.bio = dto.bio;

    const emailUpdate = dto.email !== undefined ? dto.email : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (emailUpdate !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { email: emailUpdate },
        });
      }
      if (Object.keys(profileData).length > 0) {
        await tx.profile.upsert({
          where: { userId },
          create: { userId, displayName: (dto.displayName as string) || '', ...profileData },
          update: profileData,
        });
      }
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.profile_update',
            entityType: 'user',
            entityId: userId,
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

  async forgotPassword(dto: ForgotPasswordDto) {
    return runForgotPassword(
      this.prisma,
      this.config,
      (d) => this.requestOtp(d),
      dto,
      (raw) => this.resolveAccountType(raw),
    );
  }

  async resetPassword(dto: ResetPasswordDto) {
    return runResetPassword(
      this.prisma,
      this.config,
      dto,
      (raw) => this.resolveAccountType(raw),
    );
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
    return { message: 'رمز عبور با موفقیت تغییر کرد' };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return sessions;
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'نشست لغو شد' };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'همه نشست‌ها لغو شدند' };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('کاربر یافت نشد');
    }
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('رمز عبور برای تأیید حذف الزامی است');
      }
      const ok = await argon2.verify(user.passwordHash, dto.password);
      if (!ok) {
        throw new UnauthorizedException('رمز عبور نادرست است');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.deleted,
          phone: `deleted-${userId.slice(0, 8)}`,
          email: null,
          passwordHash: null,
          phoneVerified: false,
        },
      });
      await tx.profile.updateMany({
        where: { userId },
        data: { displayName: 'کاربر حذف‌شده', avatarUrl: null, bio: null },
      });
      await tx.refreshToken.updateMany({
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
