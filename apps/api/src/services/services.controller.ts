import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  @RequirePermissions('services.view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: ServiceQueryDto) {
    return this.service.findAll(user, query);
  }

  @Post()
  @RequirePermissions('services.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('services.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions('services.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('services.disable')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }
}
