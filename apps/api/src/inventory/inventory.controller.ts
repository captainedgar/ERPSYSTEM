import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { CreateInventoryTransferDto } from './dto/create-inventory-transfer.dto';
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

  @Get('products/:productId/stock-by-branch')
  @RequirePermissions('inventory.view')
  stockByBranch(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    return this.service.stockByBranch(user, productId);
  }

  @Get('transfers')
  @RequirePermissions('inventory.transfer')
  findTransfers(@CurrentUser() user: AuthUser) {
    return this.service.findTransfers(user);
  }

  @Get('transfers/:id')
  @RequirePermissions('inventory.transfer')
  findTransfer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findTransfer(user, id);
  }

  @Post('transfers')
  @RequirePermissions('inventory.transfer')
  createTransfer(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInventoryTransferDto,
  ) {
    return this.service.createTransfer(user, dto);
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
