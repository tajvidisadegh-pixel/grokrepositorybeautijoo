import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    return this.service.list(userId, page ? parseInt(page, 10) : 1);
  }

  @Get('unread-count')
  unread(@CurrentUser('id') userId: string) {
    return this.service.unreadCount(userId).then((count) => ({ count }));
  }

  /** Mark all unread notifications as read (must be registered before :id routes). */
  @Patch('read-all')
  readAll(@CurrentUser('id') userId: string) {
    return this.service.markAllRead(userId);
  }

  @Patch(':id/read')
  read(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markRead(userId, id);
  }
}
