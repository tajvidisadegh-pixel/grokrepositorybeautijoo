import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AdminService } from './admin.service';

/**
 * Public read-only site CMS config (published only).
 * Used by the public homepage — no auth required.
 */
@ApiTags('public-site')
@Controller()
export class PublicSiteController {
  constructor(private readonly admin: AdminService) {}

  @Public()
  @Get('public/site-config')
  @ApiOperation({ summary: 'Published homepage CMS config (public)' })
  getPublishedSiteConfig() {
    return this.admin.getPublishedSiteConfig();
  }
}
