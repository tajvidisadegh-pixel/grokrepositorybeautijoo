import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewsService } from './reviews.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateReviewDto {
  @IsUUID() bookingId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() comment?: string;
}

class ReplyReviewDto {
  @IsString() @MinLength(2) @MaxLength(2000) reply!: string;
}

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Roles('customer', 'admin', 'SUPER_ADMIN')
  @Get('mine')
  listMine(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMine(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /** Reviews received by the professional */
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Get('professional')
  listForProfessional(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listForProfessional(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles('customer', 'admin', 'SUPER_ADMIN')
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.service.create(userId, dto);
  }

  /** Professional reply to a review (#9) */
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Patch(':id/reply')
  reply(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.service.replyAsProfessional(userId, id, dto.reply);
  }
}
