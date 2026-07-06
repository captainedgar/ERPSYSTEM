import { Module } from '@nestjs/common';

import { CashModule } from '../cash/cash.module';
import { PosModule } from '../pos/pos.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [PosModule, CashModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
