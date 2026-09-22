import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  Length,
  IsIn,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '09123456789' })
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone!: string;

  @ApiProperty({ example: 'SecurePass1' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: 'مریم رضایی' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'customer', enum: ['customer', 'professional'] })
  @IsOptional()
  @IsIn(['customer', 'professional'], {
    message: 'نقش ثبت‌نام فقط customer یا professional مجاز است',
  })
  role?: 'customer' | 'professional';
}

export class LoginDto {
  @ApiProperty({ example: '09123456789' })
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  /** Which panel to enter. Defaults to customer if omitted (backward compatible). */
  @ApiPropertyOptional({ example: 'customer', enum: ['customer', 'professional'] })
  @IsOptional()
  @IsIn(['customer', 'professional'], {
    message: 'نوع حساب فقط customer یا professional مجاز است',
  })
  accountType?: 'customer' | 'professional';
}

export class RequestOtpDto {
  @ApiProperty({ example: '09123456789' })
  @IsString()
  @Matches(/^09\d{9}$/)
  phone!: string;

  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ example: 'customer', enum: ['customer', 'professional'] })
  @IsOptional()
  @IsIn(['customer', 'professional'])
  accountType?: 'customer' | 'professional';
}

export class VerifyOtpDto {
  @ApiProperty({ example: '09123456789' })
  @IsString()
  @Matches(/^09\d{9}$/)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional({ example: 'login' })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ example: 'customer', enum: ['customer', 'professional'] })
  @IsOptional()
  @IsIn(['customer', 'professional'])
  accountType?: 'customer' | 'professional';
}

/** Refresh token is primarily read from httpOnly cookie. Body is optional (dev only). */
export class RefreshDto {
  @ApiPropertyOptional({ description: 'Ignored in production; use httpOnly cookie' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'مریم رضایی' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ example: 'مریم' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'رضایی' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'علاقه‌مند به خدمات زیبایی' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecurePass1' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({
    example: 'MyPassword1',
    description: 'رمز فعلی در صورت وجود؛ برای حساب‌های فقط-OTP اختیاری است',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}
