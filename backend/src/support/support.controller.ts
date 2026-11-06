import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

function isStaffUser(roles?: string[]): boolean {
  const r = Array.isArray(roles) ? roles : [];
  return r.includes('SUPER_ADMIN') || r.includes('admin');
}

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Get('tickets')
  listMine(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    return this.service.listMine(userId, page ? parseInt(page, 10) : 1);
  }

  @Get('tickets/all')
  @Roles('admin', 'SUPER_ADMIN')
  listAll(
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listAll(
      page ? parseInt(page, 10) : 1,
      40,
      status,
    );
  }

  @Get('tickets/:id')
  getOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[] | undefined,
    @Param('id') id: string,
  ) {
    return this.service.getOne(id, userId, isStaffUser(roles));
  }

  @Post('tickets')
  create(
    @CurrentUser('id') userId: string,
    @Body() body: { subject?: string; body?: string; source?: string },
  ) {
    return this.service.createTicket(
      userId,
      body?.subject ?? '',
      body?.body ?? '',
      body?.source,
    );
  }

  @Post('tickets/:id/messages')
  addMessage(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[] | undefined,
    @Param('id') id: string,
    @Body() body: { body?: string },
  ) {
    return this.service.addMessage(
      id,
      userId,
      body?.body ?? '',
      isStaffUser(roles),
    );
  }

  @Patch('tickets/:id/status')
  @Roles('admin', 'SUPER_ADMIN')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.service.setStatus(id, body?.status ?? 'open');
  }
}
