import { Module } from '@nestjs/common';

import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { MockFiscalProviderAdapter } from './adapters/mock-fiscal-provider.adapter';

@Module({
  controllers: [FiscalController],
  providers: [FiscalService, MockFiscalProviderAdapter],
})
export class FiscalModule {}
