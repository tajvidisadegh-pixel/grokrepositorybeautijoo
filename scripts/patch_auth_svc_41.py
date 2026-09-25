from pathlib import Path
import subprocess
import urllib.request

sha = '9bc3134ffec7cd91e451f59f5e9a52aab3f352c5'
try:
    raw = subprocess.check_output(
        ['git', 'show', f'{sha}:backend/src/auth/auth.service.ts'],
        text=True,
    )
except subprocess.CalledProcessError:
    url = (
        'https://raw.githubusercontent.com/tajvidisadegh-pixel/'
        f'grokrepositorybeautijoo/{sha}/backend/src/auth/auth.service.ts'
    )
    raw = urllib.request.urlopen(url, timeout=30).read().decode()

p = Path('backend/src/auth/auth.service.ts')
text = raw

marker = '  async register(dto: RegisterDto) {'
if 'private async consumeOtp' not in text:
    helper = r'''
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

'''
    text = text.replace(marker, helper + marker)

old = """    if (existing) {
      const label = roleName === 'professional' ? 'زیباگر' : 'مشتری';
      throw new ConflictException(`این شماره قبلاً به‌عنوان ${label} ثبت شده است`);
    }

    const passwordHash = await argon2.hash(dto.password);"""
new = """    if (existing) {
      const label = roleName === 'professional' ? 'زیباگر' : 'مشتری';
      throw new ConflictException(`این شماره قبلاً به‌عنوان ${label} ثبت شده است`);
    }

    // Require verified OTP (purpose register:<accountType>) before creating the user
    await this.consumeOtp(dto.phone, dto.code, `register:${accountType}`);

    const passwordHash = await argon2.hash(dto.password);"""
if old not in text:
    raise SystemExit('register block not found')
text = text.replace(old, new, 1)

old_pv = """        accountType,
        phoneVerified: false,
        profile: {
          create: { displayName: dto.displayName || dto.phone },
        },
        userRoles: { create: { roleId: role.id } },
        ...(roleName === 'professional'"""
new_pv = """        accountType,
        phoneVerified: true,
        profile: {
          create: { displayName: dto.displayName || dto.phone },
        },
        userRoles: { create: { roleId: role.id } },
        ...(roleName === 'professional'"""
if old_pv not in text:
    raise SystemExit('phoneVerified block not found')
text = text.replace(old_pv, new_pv, 1)

p.write_text(text)
assert 'consumeOtp' in text
assert 'dto.code' in text
print('patched OK', len(text))
