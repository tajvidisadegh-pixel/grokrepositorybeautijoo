import { Module } from '@nestjs/common';
import { ServiceFiltersController } from './service-filters.controller';
import { ServiceFiltersService } from './service-filters.service';
import { ProfessionalsModule } from '../professionals/professionals.module';

@Module({
  imports: [ProfessionalsModule],
  controllers: [ServiceFiltersController],
  providers: [ServiceFiltersService],
})
export class ServiceFiltersModule {}
