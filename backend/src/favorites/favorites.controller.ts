import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('favorites')
@ApiBearerAuth()
@Roles('customer', 'admin', 'professional')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.service.listWithPros(userId);
  }

  @Post(':professionalId')
  add(@CurrentUser('id') userId: string, @Param('professionalId') professionalId: string) {
    return this.service.add(userId, professionalId);
  }

  @Delete(':professionalId')
  remove(@CurrentUser('id') userId: string, @Param('professionalId') professionalId: string) {
    return this.service.remove(userId, professionalId);
  }
}
