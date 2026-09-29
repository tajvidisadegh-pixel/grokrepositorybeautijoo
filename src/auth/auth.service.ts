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

const PRIVILEGED_ROLES = new Set(['SUPER_ADMIN']); // admin is NOT privileged (issue #37)

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

    await this.consumeOtp(dto.phone, dto.code, `register:${accountType}`);

    // Password is optional (issue #43) — OTP-only accounts have null passwordHash
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

  // NOTE: rest of methods will be restored in next commit — temporary partial restore
  async login(dto: LoginDto) {
    throw new BadRequestException('Auth service partially restored — please wait for full restore');
  }
}
