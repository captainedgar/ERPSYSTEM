import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequirePlanFeature } from '../common/decorators/require-plan-feature.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { DataExportService } from './data-export.service';
import { DataExportQueryDto } from './dto/data-export-query.dto';

@Controller('data-export')
export class DataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get('products')
  @RequirePermissions('data_export.products')
  products(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'products', query),
    );
  }

  @Get('inventory')
  @RequirePermissions('data_export.inventory')
  inventory(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'inventory', query),
    );
  }

  @Get('customers')
  @RequirePermissions('data_export.customers')
  customers(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'customers', query),
    );
  }

  @Get('sales')
  @RequirePermissions('data_export.sales')
  sales(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(response, this.service.exportKind(user, 'sales', query));
  }

  @Get('sales/items')
  @RequirePermissions('data_export.sales')
  salesItems(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'sales_items', query),
    );
  }

  @Get('cash')
  @RequirePermissions('data_export.cash')
  cash(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(response, this.service.exportKind(user, 'cash', query));
  }

  @Get('inventory-movements')
  @RequirePermissions('data_export.inventory')
  inventoryMovements(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'inventory_movements', query),
    );
  }

  @Get('inventory-transfers')
  @RequirePermissions('data_export.inventory')
  inventoryTransfers(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'inventory_transfers', query),
    );
  }

  @Get('internal-documents')
  @RequirePermissions('data_export.documents')
  internalDocuments(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'internal_documents', query),
    );
  }

  @Get('reports/overview')
  @RequirePermissions('data_export.view')
  reportsOverview(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(
      response,
      this.service.exportKind(user, 'reports_overview', query),
    );
  }

  @Get('backup')
  @RequirePlanFeature('backup_xlsx')
  @RequirePermissions('data_export.full_backup')
  backup(
    @CurrentUser() user: AuthUser,
    @Query() query: DataExportQueryDto,
    @Res() response: Response,
  ) {
    return this.send(response, this.service.backup(user, query));
  }

  private async send(
    response: Response,
    file: Promise<{ buffer: Buffer; contentType: string; filename: string }>,
  ) {
    const resolved = await file;
    response.setHeader('Content-Type', resolved.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${resolved.filename}"`,
    );
    response.send(resolved.buffer);
  }
}
