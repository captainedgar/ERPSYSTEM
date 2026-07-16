import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CompanyBillingController } from './company-billing.controller';
import { CompanyBillingService } from './company-billing.service';

@Module({
  imports: [AuditModule],
  controllers: [CompanyBillingController],
  providers: [CompanyBillingService],
})
export class CompanyBillingModule {}
