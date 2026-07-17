import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { CurrentPlatformUser } from './current-platform-user.decorator';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformBillingService } from './platform-billing.service';
import {
  CancelSubscriptionPaymentLinkDto,
  CreateSaasPlanDto,
  CreateSubscriptionInvoiceDto,
  CreateSubscriptionPaymentLinkDto,
  ReportSubscriptionPaymentDto,
  ReviewPlanChangeRequestDto,
  RegisterSubscriptionPaymentDto,
  SubscriptionPaymentLinkQueryDto,
  UpdateSaasPlanDto,
  UpdateSaasPlanStatusDto,
  UpsertCompanySubscriptionDto,
  VoidSubscriptionInvoiceDto,
} from './platform-billing.dto';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';

@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform')
export class PlatformBillingController {
  constructor(private readonly billing: PlatformBillingService) {}

  @Get('plans')
  listPlans() {
    return this.billing.listPlans();
  }

  @Post('plans')
  createPlan(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Body() dto: CreateSaasPlanDto,
    @Req() request: Request,
  ) {
    return this.billing.createPlan(user, dto, requestContext(request));
  }

  @Get('plans/:id')
  getPlan(@Param('id') id: string) {
    return this.billing.getPlan(id);
  }

  @Patch('plans/:id')
  updatePlan(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaasPlanDto,
    @Req() request: Request,
  ) {
    return this.billing.updatePlan(user, id, dto, requestContext(request));
  }

  @Patch('plans/:id/status')
  updatePlanStatus(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaasPlanStatusDto,
    @Req() request: Request,
  ) {
    return this.billing.updatePlanStatus(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Get('companies/:companyId/subscription')
  getCompanySubscription(@Param('companyId') companyId: string) {
    return this.billing.getCompanySubscription(companyId);
  }

  @Put('companies/:companyId/subscription')
  upsertCompanySubscription(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('companyId') companyId: string,
    @Body() dto: UpsertCompanySubscriptionDto,
    @Req() request: Request,
  ) {
    return this.billing.upsertCompanySubscription(
      user,
      companyId,
      dto,
      requestContext(request),
    );
  }

  @Post('companies/:companyId/subscription/payments')
  registerPayment(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('companyId') companyId: string,
    @Body() dto: RegisterSubscriptionPaymentDto,
    @Req() request: Request,
  ) {
    return this.billing.registerPayment(
      user,
      companyId,
      dto,
      requestContext(request),
    );
  }

  @Get('companies/:companyId/subscription/payments')
  listCompanyPayments(@Param('companyId') companyId: string) {
    return this.billing.listCompanyPayments(companyId);
  }

  @Get('companies/:companyId/subscription/events')
  listCompanyEvents(@Param('companyId') companyId: string) {
    return this.billing.listCompanyEvents(companyId);
  }

  @Get('billing/payments')
  listPayments() {
    return this.billing.listPayments();
  }

  @Get('billing/subscriptions')
  listSubscriptions() {
    return this.billing.listSubscriptions();
  }

  @Get('billing/plan-change-requests')
  listPlanChangeRequests() {
    return this.billing.listPlanChangeRequests();
  }

  @Get('billing/payment-providers')
  paymentProviders() {
    return this.billing.paymentProviders();
  }

  @Get('billing/plan-change-requests/:id')
  getPlanChangeRequest(@Param('id') id: string) {
    return this.billing.getPlanChangeRequest(id);
  }

  @Post('billing/plan-change-requests/:id/approve')
  approvePlanChangeRequest(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewPlanChangeRequestDto,
    @Req() request: Request,
  ) {
    return this.billing.approvePlanChangeRequest(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Post('billing/plan-change-requests/:id/reject')
  rejectPlanChangeRequest(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewPlanChangeRequestDto,
    @Req() request: Request,
  ) {
    return this.billing.rejectPlanChangeRequest(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Post('billing/plan-change-requests/:id/cancel')
  cancelPlanChangeRequest(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewPlanChangeRequestDto,
    @Req() request: Request,
  ) {
    return this.billing.cancelPlanChangeRequest(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Get('billing/payment-reports')
  listPaymentReports() {
    return this.billing.listPaymentReports();
  }

  @Get('billing/invoices')
  listInvoices() {
    return this.billing.listInvoices();
  }

  @Post('billing/invoices')
  createInvoice(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Body() dto: CreateSubscriptionInvoiceDto,
    @Req() request: Request,
  ) {
    return this.billing.createInvoice(user, dto, requestContext(request));
  }

  @Get('billing/invoices/:id')
  getInvoice(@Param('id') id: string) {
    return this.billing.getInvoice(id);
  }

  @Get('billing/invoices/:id/payment-links')
  listInvoicePaymentLinks(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Query() query: SubscriptionPaymentLinkQueryDto,
  ) {
    return this.billing.listInvoicePaymentLinks(user, id, query);
  }

  @Post('billing/invoices/:id/payment-links')
  createInvoicePaymentLink(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSubscriptionPaymentLinkDto,
    @Req() request: Request,
  ) {
    return this.billing.createInvoicePaymentLink(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Post('billing/payment-links/:id/cancel')
  cancelInvoicePaymentLink(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionPaymentLinkDto,
    @Req() request: Request,
  ) {
    return this.billing.cancelInvoicePaymentLink(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Post('billing/invoices/:id/void')
  voidInvoice(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: VoidSubscriptionInvoiceDto,
    @Req() request: Request,
  ) {
    return this.billing.voidInvoice(user, id, dto, requestContext(request));
  }

  @Post('billing/invoices/:id/mark-overdue')
  markInvoiceOverdue(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.billing.markInvoiceOverdue(user, id, requestContext(request));
  }

  @Get('companies/:companyId/subscription/invoices')
  listCompanyInvoices(@Param('companyId') companyId: string) {
    return this.billing.listCompanyInvoices(companyId);
  }

  @Post('billing/process-overdue')
  processOverdue(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Req() request: Request,
  ) {
    return this.billing.processOverdueSubscriptions(
      user,
      requestContext(request),
    );
  }
}

@Public()
@Controller('pay/invoice')
export class PublicSubscriptionPaymentLinkController {
  constructor(private readonly billing: PlatformBillingService) {}

  @Get(':token')
  getPaymentLink(@Param('token') token: string) {
    return this.billing.getPublicPaymentLink(token);
  }

  @Post(':token/report')
  reportPayment(
    @Param('token') token: string,
    @Body() dto: ReportSubscriptionPaymentDto,
    @Req() request: Request,
  ) {
    return this.billing.reportPublicPayment(
      token,
      dto,
      requestContext(request),
    );
  }
}

function requestContext(request: Request): PlatformRequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
