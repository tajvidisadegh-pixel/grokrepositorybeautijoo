import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentsService } from './payments.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class InitiateDto {
  @IsUUID() bookingId!: string;
  @IsString() callbackUrl!: string;
}

class RefundDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @ApiBearerAuth()
  @Roles('customer', 'admin')
  @Post('initiate')
  @ApiOperation({ summary: 'شروع پرداخت آنلاین (بر اساس PAYMENT_PROVIDER؛ mock فقط dev/test)' })
  initiate(@CurrentUser('id') userId: string, @Body() dto: InitiateDto) {
    return this.service.initiate(userId, dto.bookingId, dto.callbackUrl);
  }

  /**
   * Callback from gateway (provider-agnostic).
   * Query shape depends on the active real provider (e.g. Authority/Status, ref, …).
   * Mock callback only works outside production.
   */
  @Public()
  @Post('callback')
  @ApiOperation({ summary: 'کالبک درگاه (POST)' })
  callbackPost(
    @Query('ref') ref?: string,
    @Query('Authority') authority?: string,
    @Query('Status') status?: string,
  ) {
    return this.service.callback(authority || ref || '', status);
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'کالبک درگاه (GET)' })
  callbackGet(
    @Query('ref') ref?: string,
    @Query('Authority') authority?: string,
    @Query('Status') status?: string,
  ) {
    return this.service.callback(authority || ref || '', status);
  }

  @ApiBearerAuth()
  @Roles('admin', 'SUPER_ADMIN')
  @Post(':id/refund')
  @ApiOperation({ summary: 'استرداد تراکنش پرداخت‌شده' })
  refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentUser('id') adminUserId?: string,
  ) {
    return this.service.refund(id, dto.reason, adminUserId);
  }
}
