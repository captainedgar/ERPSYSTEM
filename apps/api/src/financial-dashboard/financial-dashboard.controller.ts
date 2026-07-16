import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequirePlanFeature } from '../common/decorators/require-plan-feature.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { FinancialDashboardQueryDto } from './dto/financial-dashboard-query.dto';
import { FinancialDashboardService } from './financial-dashboard.service';

@Controller('financial-dashboard')
@RequirePlanFeature('financial_dashboard')
export class FinancialDashboardController {
  constructor(private readonly service: FinancialDashboardService) {}

  @Get('summary')
  @RequirePermissions('financial_dashboard.view')
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.summary(user, query);
  }

  @Get('sales-trend')
  @RequirePermissions('financial_dashboard.view', 'financial_dashboard.sales')
  salesTrend(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.salesTrend(user, query);
  }

  @Get('payment-methods')
  @RequirePermissions('financial_dashboard.view', 'financial_dashboard.sales')
  paymentMethods(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.paymentMethods(user, query);
  }

  @Get('branches')
  @RequirePermissions(
    'financial_dashboard.view',
    'financial_dashboard.branches',
  )
  branches(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.branches(user, query);
  }

  @Get('top-products')
  @RequirePermissions('financial_dashboard.view', 'financial_dashboard.sales')
  topProducts(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.topProducts(user, query);
  }

  @Get('top-customers')
  @RequirePermissions(
    'financial_dashboard.view',
    'financial_dashboard.customers',
  )
  topCustomers(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.topCustomers(user, query);
  }

  @Get('cash-health')
  @RequirePermissions('financial_dashboard.view', 'financial_dashboard.cash')
  cashHealth(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.cashHealth(user, query);
  }

  @Get('inventory-value')
  @RequirePermissions(
    'financial_dashboard.view',
    'financial_dashboard.inventory',
  )
  inventoryValue(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.inventoryValue(user, query);
  }

  @Get('alerts')
  @RequirePermissions('financial_dashboard.view')
  alerts(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialDashboardQueryDto,
  ) {
    return this.service.alerts(user, query);
  }
}
