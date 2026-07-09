import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { CurrentPlatformUser } from './current-platform-user.decorator';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformBillingService } from './platform-billing.service';
import {
  CreateSaasPlanDto,
  RegisterSubscriptionPaymentDto,
  UpdateSaasPlanDto,
  UpdateSaasPlanStatusDto,
  UpsertCompanySubscriptionDto,
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

function requestContext(request: Request): PlatformRequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
