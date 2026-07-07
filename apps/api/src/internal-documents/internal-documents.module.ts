import { Module } from '@nestjs/common';

import { InternalDocumentsController } from './internal-documents.controller';
import { InternalDocumentsService } from './internal-documents.service';

@Module({
  controllers: [InternalDocumentsController],
  providers: [InternalDocumentsService],
})
export class InternalDocumentsModule {}
