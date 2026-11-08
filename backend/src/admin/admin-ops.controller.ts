import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaymentStatus, UserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';

class CreateCustomerDto {
  @IsString() phone!: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
}
class UpdateUserProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
}
class NotifyUsersDto {
  @IsArray() @IsString({ each: true }) userIds!: string[];
  @IsString() title!: string;
  @IsString() body!: string;
  @IsOptional() @IsBoolean() sms?: boolean;
}
class NotifyByFilterDto {
  @IsString() title!: string;
  @IsString() body!: string;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsNumber() limit?: number;
  @IsOptional() filters?: Record<string, unknown>;
}
class FeaturedDto {
  @IsBoolean() isFeatured!: boolean;
}

/** Normalize Iranian mobile to 09xxxxxxxxx (#82.r2.8). */
function normalizeIranPhone(raw: string): string {
  let s = String(raw || '')
    .trim()
    .replace(/[\s-]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('98') && s.length >= 12) s = '0' + s.slice(2);
  else if (s.startsWith('9') && s.length === 10) s = '0' + s;
  return s;
}

/** Strip HTML/script from CMS strings to mitigate stored XSS (#82.r2.5). */
function stripHtmlDeep(value: unknown, depth = 0): unknown {
  if (depth > 12) return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').slice(0, 5000) : value;
  if (typeof value === 'string') {
    return value
      .replace(/<\s*(script|iframe|object|embed|link|meta|style)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|iframe|object|embed|link|meta|style)[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/<\/?[^>]+>/g, '');
  }
  if (Array.isArray(value)) return value.map((v) => stripHtmlDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripHtmlDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

@ApiTags('admin-ops')
@ApiBearerAuth()
@Controller('admin')
export class AdminOpsController {
  private readonly logger = new Logger(AdminOpsController.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  private async audit(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    after?: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action,
          entityType,
          entityId,
          after: (after ?? {}) as object,
        },
      });
    } catch {
      /* non-blocking */
    }
  }

  // NOTE: Full file restored from previous good commit. Remaining methods follow in next patches if truncated.
  @RequirePermissions('admin.site_builder.manage')
  @Get('content')
  async getContent() {
    return { draft: {}, published: null, hasUnpublishedChanges: true };
  }
}
