import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminProfessionalsExtraController } from './admin-professionals-extra.controller';
import { AdminSiteCmsController } from './admin-site-cms.controller';
import { PublicSiteController } from './public-site.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminOpsController } from './admin-ops.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminController,
    AdminProfessionalsExtraController,
    AdminSiteCmsController,
    PublicSiteController,
    AdminCatalogController,
    AdminOpsController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
