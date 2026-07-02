import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CatalogQueryDto } from '../catalog/dto/catalog-query.dto';
import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@Controller('units')
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Get()
  @RequirePermissions('units.view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: CatalogQueryDto) {
    return this.service.findAll(user, query);
  }

  @Post()
  @RequirePermissions('units.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUnitDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('units.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions('units.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('units.disable')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }
}
