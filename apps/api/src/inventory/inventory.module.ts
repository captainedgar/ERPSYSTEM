import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BranchInventoryService } from './branch-inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService, BranchInventoryService],
  exports: [BranchInventoryService],
})
export class InventoryModule {}
