import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';

@Module({
  imports: [AuditModule],
  controllers: [DataExportController],
  providers: [DataExportService],
})
export class DataExportModule {}
