import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryMovementsQueryDto } from './dto/inventory-movements-query.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { ManualEntryDto } from './dto/manual-entry.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  @RequirePermissions('inventory.view')
  findAll(@CurrentUser() user: AuthUser, @Query() query: InventoryQueryDto) {
    return this.service.findAll(user, query);
  }

  @Get('low-stock')
  @RequirePermissions('inventory.view_low_stock')
  findLowStock(
    @CurrentUser() user: AuthUser,
    @Query() query: InventoryQueryDto,
  ) {
    return this.service.findLowStock(user, query);
  }

  @Get('products/:productId/movements')
  @RequirePermissions('inventory.view_movements')
  findProductMovements(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Query() query: InventoryMovementsQueryDto,
  ) {
    return this.service.findProductMovements(user, productId, query);
  }

  @Post('products/:productId/manual-entry')
  @RequirePermissions('inventory.adjust')
  manualEntry(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: ManualEntryDto,
  ) {
    return this.service.manualEntry(user, productId, dto);
  }

  @Post('products/:productId/adjust')
  @RequirePermissions('inventory.adjust')
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.service.adjust(user, productId, dto);
  }
}
