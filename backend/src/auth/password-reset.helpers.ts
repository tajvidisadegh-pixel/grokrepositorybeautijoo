import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AccountType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { userAuthCache } from './user-auth-cache';

type OtpSender = (dto: {
  phone: string;
  purpose?: string;
  accountType?: 'customer' | 'professional';
}) => Promise<unknown>;

export async function runForgotPassword(
  prisma: PrismaService,
  config: ConfigService,
  requestOtp: OtpSender,
  dto: ForgotPasswordDto,
  resolveAccountType: (raw?: string | null) => AccountType,
) {
  const accountType = resolveAccountType(dto.accountType);
  const ttl = config.get<number>('otpTtlSeconds') || 300;
  const generic = {
    message:
      'اگر حسابی با این شماره وجود داشته باشد، کد تأیید ارسال شد. پیامک را بررسی کنید.',
    expiresIn: ttl,
  };

  const user = await prisma.user.findFirst({
    where: { phone: dto.phone, accountType },
    select: { id: true, status: true },
  });
  if (!user || user.status !== UserStatus.active) {
    return generic;
  }

  await requestOtp({
    phone: dto.phone,
    purpose: 'reset_password',
    accountType: dto.accountType,
  });
  return generic;
}

export async function runResetPassword(
  prisma: PrismaService,
  config: ConfigService,
  dto: ResetPasswordDto,
  resolveAccountType: (raw?: string | null) => AccountType,
) {
  if (!dto.newPassword || dto.newPassword.length < 8) {
    throw new BadRequestException('رمز جدید باید حداقل ۸ کاراکتر باشد');
  }

  const accountType = resolveAccountType(dto.accountType);
  const purpose = `reset_password:${accountType}`;
  const otp = await prisma.otpCode.findFirst({
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

  const maxAttempts = config.get<number>('otpMaxAttempts') || 3;
  if (otp.attempts >= maxAttempts) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
    throw new UnauthorizedException(
      'تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.',
    );
  }

  const valid = await argon2.verify(otp.codeHash, dto.code);
  if (!valid) {
    const updated = await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= maxAttempts) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException(
        'تعداد تلاش بیش از حد. لطفاً کد جدید درخواست کنید.',
      );
    }
    throw new UnauthorizedException('کد نادرست است');
  }

  const user = await prisma.user.findFirst({
    where: { phone: dto.phone, accountType },
  });
  if (!user || user.status !== UserStatus.active) {
    throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');
  }

  const passwordHash = await argon2.hash(dto.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, phoneVerified: true },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    try {
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'user.password_reset',
          entityType: 'user',
          entityId: user.id,
        },
      });
    } catch {
      /* non-blocking */
    }
  });
  userAuthCache.invalidate(user.id);
  return {
    message: 'رمز عبور با موفقیت تغییر کرد. اکنون با رمز جدید وارد شوید.',
  };
}
