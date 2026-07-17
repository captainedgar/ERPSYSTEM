import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CompanyBillingController } from './company-billing.controller';
import { CompanyBillingService } from './company-billing.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  imports: [AuditModule],
  controllers: [CompanyBillingController, PaymentWebhookController],
  providers: [CompanyBillingService, PaymentGatewayService],
})
export class CompanyBillingModule {}
