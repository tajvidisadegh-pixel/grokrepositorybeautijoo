import { Global, Module } from '@nestjs/common';
import { JobLeaseService } from './job-lease.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [JobLeaseService],
  exports: [JobLeaseService],
})
export class JobsModule {}
