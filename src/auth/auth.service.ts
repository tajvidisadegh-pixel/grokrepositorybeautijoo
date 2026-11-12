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
import { AccountType, BookingStatus, ProfessionalStatus, UserStatus } from '@prisma/client';
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

const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN']); // admin is NOT privileged (issue #37)

@Injectable()
export class AuthService {
  /** #82.med15 — in-memory per-IP OTP request hits (process-local) */
  private readonly otpIpHits = new Map<string, { count: number; windowStart: number }>();
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

  private normalizePhone(raw?: string | null): string {
    let s = String(raw || '').trim().replace(/[\s-]/g, '');
    s = s.replace(/^\+/, '');
    if (s.startsWith('0098')) s = s.slice(4);
    else if (s.startsWith('98') && s.length >= 12) s = s.slice(2);
    if (s.startsWith('9') && s.length === 10) s = '0' + s;
    return s;
  }

  private phoneLookupVariants(phone: string): string[] {
    const n = this.normalizePhone(phone);
    const set = new Set<string>();
    if (phone) set.add(String(phone).trim());
    if (n) set.add(n);
    if (n.startsWith('0') && n.length === 11) {
      set.add('98' + n.slice(1));
      set.add('+98' + n.slice(1));
    }
    return [...set].filter(Boolean);
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


  /**
   * Consume a valid unused OTP for the given phone+purpose.
   */
  private async consumeOtp(
    phone: string,
    code: string,
    purpose: string,
  ): Promise<void> {
    const maxAttempts = this.config.get<number>('otpMaxAttempts') || 3;
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new UnauthorizedException('کد تأیید نامعتبر یا منقضی شده است');
    }
    if (otp.attempts >= maxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException(
        'تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.',
      );
    }
    const valid = await argon2.verify(otp.codeHash, code);
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
      }
      throw new UnauthorizedException('کد نادرست است');
    }
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
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

    // Require verified OTP (purpose register:<accountType>) before creating the user
    await this.consumeOtp(dto.phone, dto.code, `register:${accountType}`);

    // Password is optional (issue #43) - OTP-only accounts have null passwordHash
    // #82.med16 — non-empty password shorter than 8 must error (was silently ignored)
    if (dto.password != null && dto.password !== '' && dto.password.length < 8) {
      throw new BadRequestException('رمز عبور حداقل ۸ کاراکتر باشد');
    }
    const passwordHash =
      dto.password && dto.password.length >= 8
        ? await argon2.hash(dto.password)
        : null;
    const role = await this.prisma.role.findUniqueOrThrow({ where: { name: roleName } });

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        accountType,
        phoneVerified: true,
        profile: {
          create: { displayName: dto.displayName || dto.phone },
        },
        userRoles: { create: { roleId: role.id } },
        ...(roleName === 'professional'
          ? {
              professional: {
                create: {
                  title: dto.displayName || 'زیباگر',
                  slug: `pro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
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
    const roleWanted = accountType === AccountType.professional ? 'professional' : 'customer';
    const phones = this.phoneLookupVariants(dto.phone);
    const candidates = await this.prisma.user.findMany({
      where: { phone: { in: phones } },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    let user =
      candidates.find((u) => u.accountType === accountType && u.passwordHash) ||
      candidates.find((u) => u.accountType === accountType) ||
      candidates.find((u) => u.userRoles.some((ur) => ur.role.name === roleWanted) && u.passwordHash) ||
      candidates.find((u) => u.userRoles.some((ur) => ur.role.name === roleWanted)) ||
      null;

    if (!user) {
      if (candidates.length > 0) {
        const otherType = candidates[0].accountType;
        const other = otherType === AccountType.professional ? 'زیباگر' : 'کاربری';
        const want = roleWanted === 'professional' ? 'زیباگر' : 'کاربری';
        throw new UnauthorizedException(
          'برای این شماره حساب ' +
            want +
            ' پیدا نشد. اگر حساب ' +
            other +
            ' دارید نوع ورود را عوض کنید.',
        );
      }
      throw new UnauthorizedException('شماره یا رمز عبور نادرست است');
    }

    if (!user.passwordHash) {
      const want = roleWanted === 'professional' ? 'زیباگر' : 'کاربری';
      throw new UnauthorizedException(
        'این حساب ' +
          want +
          ' فقط با کد پیامکی قابل ورود است. برای ورود با رمز از فراموشی رمز استفاده کنید.',
      );
    }

    if (user.status !== UserStatus.active) {
      throw new UnauthorizedException('حساب کاربری غیرفعال است');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException('شماره یا رمز عبور نادرست است');
    }
    // #40 item 32
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
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

  async requestOtp(dto: RequestOtpDto, clientIp?: string) {
    // #82.med15 — purpose whitelist
    const allowedPurposes = new Set([
      'login',
      'register',
      'password_reset',
      'reset_password', // alias — normalized below
      'change_phone',
      'delete_account',
    ]);
    let purposeBase = (dto.purpose || 'login').toString().trim();
    if (!allowedPurposes.has(purposeBase)) {
      throw new BadRequestException('هدف درخواست کد نامعتبر است');
    }
    // Unify legacy reset_password -> password_reset (forgot-password OTP)
    if (purposeBase === 'reset_password') {
      purposeBase = 'password_reset';
    }
    // #82.med15 — per-IP soft limit (default 20 / 10 min)
    if (clientIp) {
      const maxIp = parseInt(process.env.OTP_MAX_PER_IP_10M || '20', 10) || 20;
      const now = Date.now();
      const windowMs = 600_000;
      const entry = this.otpIpHits.get(clientIp);
      if (!entry || now - entry.windowStart > windowMs) {
        this.otpIpHits.set(clientIp, { count: 1, windowStart: now });
      } else {
        entry.count += 1;
        if (entry.count > maxIp) {
          throw new BadRequestException(
            'تعداد درخواست از این شبکه بیش از حد مجاز است. کمی بعد دوباره تلاش کنید',
          );
        }
      }
    }
    const accountType = this.resolveAccountType(dto.accountType);
    const purpose = `${purposeBase}:${accountType}`;
    const ttl = this.config.get<number>('otpTtlSeconds') || 300;
    const cooldown = this.config.get<number>('otpCooldownSeconds') || 60;
    // #82.13 — defaults align with configuration.ts / .env.example (was || 100)
    const maxPerHour = this.config.get<number>('otpMaxPerHour') || 3;
    const maxPerDay = this.config.get<number>('otpMaxPerDay') || 8;

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
      throw new BadRequestException(
        wait >= 55
          ? 'لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید'
          : `لطفاً ${wait} ثانیه صبر کنید و دوباره تلاش کنید`,
      );
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
      throw new BadRequestException('تعداد درخواست کد بیش از حد مجاز است. حدود ۱۰ دقیقه دیگر دوباره تلاش کنید');
    }
    if (daily >= maxPerDay) {
      throw new BadRequestException('سقف روزانه درخواست کد پر شده است. فردا دوباره تلاش کنید');
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

    const roleWantedOtp = accountType === AccountType.professional ? 'professional' : 'customer';
    const otpCandidates = await this.prisma.user.findMany({
      where: { phone: dto.phone },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    let user =
      otpCandidates.find((u) => u.accountType === accountType) ||
      otpCandidates.find((u) => u.userRoles.some((ur) => ur.role.name === roleWantedOtp)) ||
      null;

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
                    slug: `pro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
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

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
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


  async setSmsOptOut(userId: string, optOut: boolean) {
    const key = 'sms_opt_out_user_ids';
    const MAX = 50_000;
    const ids = await this.prisma.$transaction(async (tx) => {
      const row = await tx.platformSetting.findUnique({ where: { key } });
      const prev = Array.isArray(row?.value)
        ? (row!.value as string[])
        : Array.isArray((row?.value as any)?.ids)
          ? ((row!.value as any).ids as string[])
          : [];
      let next = prev.map(String);
      if (optOut) {
        if (!next.includes(userId)) next.push(userId);
      } else {
        next = next.filter((x) => x !== userId);
      }
      if (next.length > MAX) next = next.slice(next.length - MAX);
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: next as any },
        update: { value: next as any },
      });
      return next;
    });
    return { ok: true, optOut, idsCount: ids.length };
  }

  async issueImpersonationAccessToken(
    customerId: string,
    customerPhone: string | null,
    adminId: string,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    // #r4.H9 — impersonation tokens are short-lived and non-refreshable
    const configured = (this.config.get<string>('jwt.impersonationTtl') || process.env.JWT_IMPERSONATION_TTL || '15m').trim();
    const accessTtl = configured;
    const accessToken = await this.jwt.signAsync(
      {
        sub: customerId,
        phone: customerPhone ?? undefined,
        imp: adminId,
        impMode: true,
        // block elevated claims while impersonating
        roles: ['customer'],
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
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        professional: { select: { id: true, status: true, title: true, slug: true } },
      },
    });
    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role?.rolePermissions || []) {
        if (rp.permission?.code) permissions.add(rp.permission.code);
      }
    }
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      status: user.status,
      accountType: user.accountType,
      phoneVerified: user.phoneVerified,
      displayName: user.profile?.displayName,
      avatarUrl: user.profile?.avatarUrl,
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            avatarUrl: user.profile.avatarUrl,
            bio: user.profile.bio,
            gender: user.profile.gender,
          }
        : null,
      roles,
      permissions: Array.from(permissions),
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
    if (dto.firstName !== undefined) profileData.firstName = dto.firstName;
    if (dto.lastName !== undefined) profileData.lastName = dto.lastName;
    if (dto.gender !== undefined) profileData.gender = dto.gender;

    const emailUpdate = dto.email !== undefined ? dto.email : undefined;

    try {
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
    } catch (e: unknown) {
      // #82.med17 — duplicate email must be 400, not Prisma 500
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException('این ایمیل قبلاً ثبت شده است');
      }
      throw e;
    }

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
    // #82.high3 — require password OR OTP depending on account type
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('رمز عبور برای تأیید حذف الزامی است');
      }
      const ok = await argon2.verify(user.passwordHash, dto.password);
      if (!ok) {
        throw new UnauthorizedException('رمز عبور نادرست است');
      }
    } else {
      if (!dto.code?.trim()) {
        throw new BadRequestException(
          'برای حذف حساب بدون رمز، ابتدا کد تأیید را از /auth/request-otp با purpose=delete_account دریافت و ارسال کنید',
        );
      }
      if (!user.phone) {
        throw new BadRequestException('شماره موبایل برای تأیید حذف موجود نیست');
      }
      const purpose = `delete_account:${user.accountType}`;
      await this.consumeOtp(user.phone, dto.code.trim(), purpose);
    }

    await this.prisma.$transaction(async (tx) => {
      // #82.high2 — cancel active future bookings owned as customer
      const activeCustomerBookings = await tx.booking.findMany({
        where: {
          customerId: userId,
          status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
          startAt: { gte: new Date() },
        },
        select: { id: true },
      });
      if (activeCustomerBookings.length) {
        await tx.booking.updateMany({
          where: { id: { in: activeCustomerBookings.map((b) => b.id) } },
          data: { status: BookingStatus.cancelled },
        });
      }

      let cancelledProCount = 0;
      const pro = await tx.professional.findFirst({ where: { userId } });
      if (pro) {
        // #82.high2 — hide professional profile
        await tx.professional.update({
          where: { id: pro.id },
          data: {
            status: 'suspended',
            title: 'حساب حذف‌شده',
            bio: null,
            logoUrl: null,
            coverImageUrl: null,
            isFeatured: false,
            publishedAt: null,
          },
        });
        const activeProBookings = await tx.booking.findMany({
          where: {
            professionalId: pro.id,
            status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
            startAt: { gte: new Date() },
          },
          select: { id: true },
        });
        cancelledProCount = activeProBookings.length;
        if (activeProBookings.length) {
          await tx.booking.updateMany({
            where: { id: { in: activeProBookings.map((b) => b.id) } },
            data: { status: BookingStatus.cancelled },
          });
        }
      }

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
            after: {
              anonymized: true,
              status: 'deleted',
              cancelledCustomerBookings: activeCustomerBookings.length,
              cancelledProBookings: cancelledProCount,
              proHidden: !!pro,
            } as any,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'حساب کاربری با موفقیت حذف و داده‌های شخصی ناشناس شد' };
  }


  /** #40 item 55 — change phone with OTP on the new number */
  async requestChangePhone(userId: string, newPhoneRaw: string) {
    const newPhone = (newPhoneRaw || '').trim();
    if (!/^09\d{9}$/.test(newPhone)) {
      throw new BadRequestException('شماره موبایل نامعتبر است');
    }
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new UnauthorizedException();
    if (me.phone === newPhone) {
      throw new BadRequestException('این همان شماره فعلی شماست');
    }
    const taken = await this.prisma.user.findFirst({
      where: { phone: newPhone, id: { not: userId }, status: { not: UserStatus.deleted } },
    });
    if (taken) {
      throw new BadRequestException('این شماره قبلاً ثبت‌نام شده است');
    }
    // reuse OTP pipeline with purpose change_phone
    return this.requestOtp({ phone: newPhone, purpose: 'change_phone', accountType: me.accountType } as any);
  }

  async verifyChangePhone(userId: string, newPhoneRaw: string, code: string) {
    const newPhone = (newPhoneRaw || '').trim();
    if (!/^09\d{9}$/.test(newPhone) || !code?.trim()) {
      throw new BadRequestException('داده‌ها نامعتبر است');
    }
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new UnauthorizedException();
    const purpose = `change_phone:${me.accountType}`;
    await this.consumeOtp(newPhone, code.trim(), purpose);
    const taken = await this.prisma.user.findFirst({
      where: { phone: newPhone, id: { not: userId }, status: { not: UserStatus.deleted } },
    });
    if (taken) {
      throw new BadRequestException('این شماره قبلاً ثبت‌نام شده است');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone: newPhone, phoneVerified: true },
    });
    userAuthCache.invalidate(userId);
    return { message: 'شماره موبایل با موفقیت تغییر کرد', phone: newPhone };
  }

}
