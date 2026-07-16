import { Global, Module } from '@nestjs/common';

import { CompanyEntitlementsService } from './company-entitlements.service';

@Global()
@Module({
  providers: [CompanyEntitlementsService],
  exports: [CompanyEntitlementsService],
})
export class CompanyEntitlementsModule {}
