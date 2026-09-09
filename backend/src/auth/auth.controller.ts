import { Body, Controller, Get, Post, HttpCode, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RequestOtpDto, VerifyOtpDto, RefreshDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  clearRefreshCookie,
  readRefreshFromRequest,
  setRefreshCookie,
} from './auth-cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private attachTokens(
    res: Response,
    result: { accessToken: string; refreshToken: string; [k: string]: unknown },
  ) {
    setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _rt, ...rest } = result;
    return { ...rest };
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    return this.attachTokens(res, result as any);
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
    return this.attachTokens(res, result as any);
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
    return this.attachTokens(res, result as any);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshFromRequest(req, dto?.refreshToken);
    if (!token) {
      clearRefreshCookie(res);
      throw new UnauthorizedException('نشست منقضی شده است');
    }
    try {
      const result = await this.auth.refresh(token);
      return this.attachTokens(res, result as any);
    } catch (e) {
      clearRefreshCookie(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshFromRequest(req, dto?.refreshToken);
    if (token) {
      try {
        await this.auth.logout(token);
      } catch {
        /* ignore */
      }
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
  @Post('enable-customer-role')
  enableCustomerRole(@CurrentUser('id') userId: string) {
    return this.auth.enableCustomerRole(userId);
  }
}
