import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CompanyBillingService } from './company-billing.service';
import { RequestPlanChangeDto } from './company-billing.dto';

@Controller('company-billing')
export class CompanyBillingController {
  constructor(private readonly billing: CompanyBillingService) {}

  @Get('subscription')
  @RequirePermissions('billing.view')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.getSubscription(user.companyId);
  }

  @Get('invoices')
  @RequirePermissions('billing.invoices.view')
  invoices(@CurrentUser() user: AuthUser) {
    return this.billing.listInvoices(user.companyId);
  }

  @Get('invoices/:id')
  @RequirePermissions('billing.invoices.view')
  invoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.getInvoice(user.companyId, id);
  }

  @Post('invoices/:id/payment-link')
  @RequirePermissions('billing.pay')
  paymentLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.getAvailablePaymentLink(user.companyId, id);
  }

  @Get('payments')
  @RequirePermissions('billing.payments.view')
  payments(@CurrentUser() user: AuthUser) {
    return this.billing.listPayments(user.companyId);
  }

  @Get('events')
  @RequirePermissions('billing.view')
  events(@CurrentUser() user: AuthUser) {
    return this.billing.listEvents(user.companyId);
  }

  @Get('entitlements')
  @RequirePermissions('billing.view')
  entitlements(@CurrentUser() user: AuthUser) {
    return this.billing.getEntitlements(user.companyId);
  }

  @Get('plans')
  @RequirePermissions('billing.view')
  plans() {
    return this.billing.listAvailablePlans();
  }

  @Get('plan-change-requests')
  @RequirePermissions('billing.view')
  planChangeRequests(@CurrentUser() user: AuthUser) {
    return this.billing.listPlanChangeRequests(user.companyId);
  }

  @Get('payment-instructions')
  @RequirePermissions('billing.view')
  paymentInstructions() {
    return this.billing.getPaymentInstructions();
  }

  @Post('plan-change-request')
  @RequirePermissions('billing.pay')
  requestPlanChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestPlanChangeDto,
  ) {
    return this.billing.requestPlanChange(user, dto.planCode);
  }
}
