import { Body, Controller, Param, Post, Query } from '@nestjs/common';
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
  initiate(@CurrentUser('id') userId: string, @Body() dto: InitiateDto) {
    return this.service.initiate(userId, dto.bookingId, dto.callbackUrl);
  }

  @Public()
  @Post('callback')
  callback(@Query('ref') ref: string) {
    return this.service.callback(ref);
  }

  @ApiBearerAuth()
  @Roles('admin', 'SUPER_ADMIN')
  @Post(':id/refund')
  @ApiOperation({ summary: 'استرداد تراکنش پرداخت‌شده (Mock / Gateway)' })
  refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentUser('id') adminUserId?: string,
  ) {
    return this.service.refund(id, dto.reason, adminUserId);
  }
}
