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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly service: BrandsService) {}

  @Get()
  @RequirePermissions('brands.view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: CatalogQueryDto) {
    return this.service.findAll(user, query);
  }

  @Post()
  @RequirePermissions('brands.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBrandDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('brands.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions('brands.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('brands.disable')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }
}
