import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  HttpCode,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RequestOtpDto,
  VerifyOtpDto,
  RefreshDto,
  UpdateProfileDto,
  ChangePasswordDto,
  DeleteAccountDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  allowRefreshBodyFallback,
  attachRefreshCookieAndSanitize,
  clearRefreshCookie,
  readRefreshFromRequest,
} from './auth-cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    return attachRefreshCookieAndSanitize(res, result);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    return attachRefreshCookieAndSanitize(res, result);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(dto);
    return attachRefreshCookieAndSanitize(res, result);
  }

  /**
   * Rotate refresh token.
   * Cookie is the primary (and production-only) transport.
   * Body refreshToken accepted only when REFRESH_ALLOW_BODY=true or non-production.
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshDto = {},
  ) {
    const token = readRefreshFromRequest(req, body?.refreshToken, {
      allowBodyFallback: allowRefreshBodyFallback(),
    });
    if (!token) {
      clearRefreshCookie(res);
      throw new UnauthorizedException('توکن نامعتبر است');
    }
    const result = await this.auth.refresh(token);
    return attachRefreshCookieAndSanitize(res, result);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: RefreshDto = {},
  ) {
    const token = readRefreshFromRequest(req, body?.refreshToken, {
      allowBodyFallback: allowRefreshBodyFallback(),
    });
    if (token) {
      await this.auth.logout(token);
    }
    clearRefreshCookie(res);
    return { message: 'خروج انجام شد' };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  @ApiBearerAuth()
  @Patch('me')
  @HttpCode(200)
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(userId, dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @ApiBearerAuth()
  @Get('sessions')
  listSessions(@CurrentUser('id') userId: string) {
    return this.auth.listSessions(userId);
  }

  @ApiBearerAuth()
  @Post('sessions/:id/revoke')
  @HttpCode(200)
  revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    return this.auth.revokeSession(userId, sessionId);
  }

  @ApiBearerAuth()
  @Post('sessions/revoke-all')
  @HttpCode(200)
  revokeAllSessions(@CurrentUser('id') userId: string) {
    return this.auth.revokeAllSessions(userId);
  }

  @ApiBearerAuth()
  @Post('delete-account')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.deleteAccount(userId, dto.password);
    clearRefreshCookie(res);
    return result;
  }
}
