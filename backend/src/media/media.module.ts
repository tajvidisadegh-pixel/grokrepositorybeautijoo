import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { FilesController } from './files.controller';
import { ProfessionalsModule } from '../professionals/professionals.module';

@Module({
  imports: [ProfessionalsModule],
  controllers: [MediaController, FilesController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
