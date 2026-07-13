import { Module } from '@nestjs/common';

import { ProductCompatibilityController } from './product-compatibility.controller';
import { ProductCompatibilityService } from './product-compatibility.service';

@Module({
  controllers: [ProductCompatibilityController],
  providers: [ProductCompatibilityService],
  exports: [ProductCompatibilityService],
})
export class ProductCompatibilityModule {}
