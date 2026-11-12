#!/usr/bin/env python3
from pathlib import Path
import sys

auth = Path('backend/src/auth/auth.service.ts')
dto = Path('backend/src/auth/dto/auth.dto.ts')
helpers = Path('backend/src/auth/password-reset.helpers.ts')

if not auth.is_file() or not dto.is_file():
    print('missing auth/dto')
    sys.exit(1)

# --- DTO: currentPassword optional ---
t = dto.read_text()
old_dto = """export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecurePass1' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}"""
new_dto = """export class ChangePasswordDto {
  /** Optional when account is OTP-only and setting the first password. */
  @ApiPropertyOptional({ example: 'OldPass123', description: 'برای حساب‌های بدون رمز لازم نیست' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  currentPassword?: string;

  @ApiProperty({ example: 'NewSecurePass1' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}"""
if old_dto in t:
    t = t.replace(old_dto, new_dto, 1)
    dto.write_text(t)
    print('dto patched')
elif 'OTP-only and setting the first password' in t:
    print('dto already')
else:
    print('dto pattern missing')
    sys.exit(1)

# --- auth.service changePassword ---
t = auth.read_text()
old_cp = """  async changePassword(userId: string, dto: ChangePasswordDto) {
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
    const passwordHash = await argon2.hash(dto.newPassword);"""
new_cp = """  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('حساب یافت نشد');
    }
    if (user.status !== UserStatus.active) {
      throw new BadRequestException('حساب کاربری غیرفعال است');
    }
    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('رمز جدید باید حداقل ۸ کاراکتر باشد');
    }
    // OTP-only: allow setting the first password while authenticated (JWT).
    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('رمز فعلی الزامی است');
      }
      const ok = await argon2.verify(user.passwordHash, dto.currentPassword);
      if (!ok) {
        throw new UnauthorizedException('رمز فعلی اشتباه است');
      }
      if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException('رمز جدید باید با رمز فعلی متفاوت باشد');
      }
    }
    const passwordHash = await argon2.hash(dto.newPassword);"""
if old_cp in t:
    t = t.replace(old_cp, new_cp, 1)
    auth.write_text(t)
    print('changePassword patched')
elif 'OTP-only: allow setting the first password' in t:
    print('changePassword already')
else:
    print('changePassword pattern missing')
    sys.exit(1)

# --- helpers phone variants (forgot/reset) ---
if helpers.is_file():
    h = helpers.read_text()
    if 'phoneVariants' not in h:
        insert = '''
function normalizePhoneLocal(raw?: string | null): string {
  let s = String(raw || '').trim().replace(/[\\s-]/g, '');
  s = s.replace(/^\\+/, '');
  if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('98') && s.length >= 12) s = s.slice(2);
  if (s.startsWith('9') && s.length === 10) s = '0' + s;
  return s;
}
function phoneVariants(phone: string): string[] {
  const n = normalizePhoneLocal(phone);
  const set = new Set<string>();
  if (phone) set.add(String(phone).trim());
  if (n) set.add(n);
  if (n.startsWith('0') && n.length === 11) {
    set.add('98' + n.slice(1));
    set.add('+98' + n.slice(1));
  }
  return [...set].filter(Boolean);
}

'''
        if 'type OtpSender' not in h:
            print('helpers OtpSender missing')
        else:
            h = h.replace('type OtpSender = (dto: {', insert + 'type OtpSender = (dto: {', 1)
            h = h.replace(
                'where: { phone: dto.phone, accountType },\n    select: { id: true, status: true },',
                'where: { phone: { in: phoneVariants(dto.phone) }, accountType },\n    select: { id: true, status: true },',
                1,
            )
            h = h.replace(
                "where: { phone: dto.phone, accountType },\n  });\n  if (!user || user.status !== UserStatus.active) {\n    throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');\n  }",
                "where: { phone: { in: phoneVariants(dto.phone) }, accountType },\n  });\n  if (!user || user.status !== UserStatus.active) {\n    throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');\n  }",
                1,
            )
            helpers.write_text(h)
            print('helpers patched')
    else:
        print('helpers already')
print('done')
