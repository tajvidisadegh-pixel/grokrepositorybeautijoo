import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminSiteCmsController {
  constructor(private readonly service: AdminService) {}

  @Post('site-cms/publish')
  @ApiOperation({ summary: 'Publish site CMS draft (content + sections) to public site' })
  publishSiteCms(@CurrentUser('id') actorId?: string) {
    return this.service.publishSiteCms(actorId);
  }
}
