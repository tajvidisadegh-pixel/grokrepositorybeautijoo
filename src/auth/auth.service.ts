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
  // TRUNCATED - use full file from artifacts
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
}
