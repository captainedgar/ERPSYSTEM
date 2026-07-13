import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { ProductCompatibilityController } from './product-compatibility.controller';
import { ProductCompatibilityService } from './product-compatibility.service';

@Module({
  imports: [InventoryModule],
  controllers: [ProductCompatibilityController],
  providers: [ProductCompatibilityService],
  exports: [ProductCompatibilityService],
})
export class ProductCompatibilityModule {}
