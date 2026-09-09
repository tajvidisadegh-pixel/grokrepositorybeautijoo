import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, Matches, Length, IsIn } from 'class-validator';

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

  /**
   * Public registration: only customer | professional.
   * Each role is a fully separate account even when phone is the same.
   */
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

  /**
   * Which panel/account to enter. Required for correct separation of
   * customer vs professional when the same phone has both accounts.
   */
  @ApiProperty({ example: 'customer', enum: ['customer', 'professional'] })
  @IsIn(['customer', 'professional'], {
    message: 'نوع حساب فقط customer یا professional مجاز است',
  })
  accountType!: 'customer' | 'professional';
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

  /** Target account persona for OTP login (defaults to customer). */
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

  /** Target account persona. OTP never auto-creates the other persona. */
  @ApiPropertyOptional({ example: 'customer', enum: ['customer', 'professional'] })
  @IsOptional()
  @IsIn(['customer', 'professional'])
  accountType?: 'customer' | 'professional';
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
