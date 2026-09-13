import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminProfessionalsExtraController } from './admin-professionals-extra.controller';

@Module({
  controllers: [AdminController, AdminProfessionalsExtraController],
  providers: [AdminService],
})
export class AdminModule {}
