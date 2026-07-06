import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Get()
  @RequirePermissions('sales.view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: SalesQueryDto) {
    return this.service.findAll(user, query);
  }

  @Post()
  @RequirePermissions('sales.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.service.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('sales.view_detail')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelSaleDto,
  ) {
    return this.service.cancel(user, id, dto);
  }
}
