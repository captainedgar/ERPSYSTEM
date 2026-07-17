import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import {
  PlatformBillingController,
  PublicSubscriptionPaymentLinkController,
} from './platform-billing.controller';
import { PlatformBillingService } from './platform-billing.service';
import { PaymentGatewayService } from '../company-billing/payment-gateway.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    PlatformAuthController,
    PlatformAdminController,
    PlatformBillingController,
    PublicSubscriptionPaymentLinkController,
  ],
  providers: [
    PlatformAuthGuard,
    PlatformAuthService,
    PlatformAdminService,
    PlatformAuditService,
    PlatformBillingService,
    PaymentGatewayService,
  ],
})
export class PlatformAdminModule {}
