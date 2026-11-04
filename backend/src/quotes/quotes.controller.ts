import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuotesService } from './quotes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

class CreateQuoteDto {
  @IsUUID() professionalId!: string;
  @IsOptional() @IsUUID() professionalServiceId?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
}

class RespondQuoteDto {
  @IsIn(['quoted', 'declined']) status!: 'quoted' | 'declined';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) quotedPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) quotedDurationMin?: number;
  @IsOptional() @IsString() @MinLength(0) responseNote?: string;
}

@ApiTags('quotes')
@ApiBearerAuth()
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post('quotes')
  @Roles('customer', 'user', 'admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Customer: request a price quote (optional photos) (#80.3)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(userId, dto);
  }

  @Get('quotes/mine')
  @Roles('customer', 'user', 'admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Customer: list my quote requests (#80.3)' })
  listMine(@CurrentUser('id') userId: string) {
    return this.quotes.listMineAsCustomer(userId);
  }

  @Patch('quotes/:id/cancel')
  @Roles('customer', 'user', 'admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Customer: cancel pending quote (#80.3)' })
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.quotes.cancelAsCustomer(userId, id);
  }

  @Get('professionals/me/quotes')
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Pro: list incoming quote requests (#80.3)' })
  listPro(@CurrentUser('id') userId: string) {
    return this.quotes.listMineAsPro(userId);
  }

  @Patch('professionals/me/quotes/:id')
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Pro: respond to quote request (#80.3)' })
  respond(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RespondQuoteDto,
  ) {
    return this.quotes.respond(userId, id, dto);
  }
}
