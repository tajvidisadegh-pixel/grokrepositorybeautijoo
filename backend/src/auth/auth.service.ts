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
import { AccountType, ProfessionalStatus } from '@prisma/client';
import { RegisterDto, LoginDto, RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
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

    // Prefer exact accountType match; for privileged admins also try any account on this phone
    let user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, accountType },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.passwordHash) {
      // Fallback: find any active user with this phone that has SUPER_ADMIN/admin
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

    // Panel gates apply only to non-admin accounts
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
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
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
}
