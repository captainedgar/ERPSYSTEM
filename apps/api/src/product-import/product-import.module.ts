import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductImportController } from './product-import.controller';
import { ProductImportService } from './product-import.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ProductImportController],
  providers: [ProductImportService],
})
export class ProductImportModule {}
