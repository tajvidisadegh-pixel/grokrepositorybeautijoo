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

  // NOTE: remaining methods are in auth.service.rest.ts — see companion file
  // This temporary split is restored in the next commit if incomplete.
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
}
