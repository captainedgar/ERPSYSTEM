import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @RequirePermissions('reports.view')
  overview(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.overview(user, query);
  }

  @Get('sales')
  @RequirePermissions('reports.sales')
  sales(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.sales(user, query);
  }

  @Get('sales/by-day')
  @RequirePermissions('reports.sales')
  salesByDay(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.salesByDay(user, query);
  }

  @Get('sales/by-user')
  @RequirePermissions('reports.sales')
  salesByUser(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.salesByUser(user, query);
  }

  @Get('sales/top-products')
  @RequirePermissions('reports.sales')
  topProducts(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.topProducts(user, query);
  }

  @Get('cash')
  @RequirePermissions('reports.cash')
  cash(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.cash(user, query);
  }

  @Get('customers')
  @RequirePermissions('reports.customers')
  customers(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.customers(user, query);
  }

  @Get('inventory/low-stock')
  @RequirePermissions('reports.inventory')
  lowStock(@CurrentUser() user: AuthUser) {
    return this.reports.lowStock(user);
  }

  @Get('documents')
  @RequirePermissions('reports.documents')
  documents(@CurrentUser() user: AuthUser, @Query() query: ReportsQueryDto) {
    return this.reports.documents(user, query);
  }
}
