import {
  Body,
  Controller,
  Get,
  Post,
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
}
