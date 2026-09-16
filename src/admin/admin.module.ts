import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminProfessionalsExtraController } from './admin-professionals-extra.controller';
import { AdminSiteCmsController } from './admin-site-cms.controller';
import { PublicSiteController } from './public-site.controller';
import { AdminCatalogController } from './admin-catalog.controller';

@Module({
  controllers: [
    AdminController,
    AdminProfessionalsExtraController,
    AdminSiteCmsController,
    PublicSiteController,
    AdminCatalogController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
