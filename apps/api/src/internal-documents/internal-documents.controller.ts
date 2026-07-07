import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateInternalDocumentDto } from './dto/create-internal-document.dto';
import { InternalDocumentsQueryDto } from './dto/internal-documents-query.dto';
import { VoidInternalDocumentDto } from './dto/void-internal-document.dto';
import { InternalDocumentsService } from './internal-documents.service';

@Controller()
export class InternalDocumentsController {
  constructor(private readonly service: InternalDocumentsService) {}

  @Get('internal-documents')
  @RequirePermissions('internal_documents.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: InternalDocumentsQueryDto,
  ) {
    return this.service.findAll(user, query);
  }

  @Post('internal-documents/from-sale/:saleId')
  @RequirePermissions('internal_documents.create')
  createFromSale(
    @CurrentUser() user: AuthUser,
    @Param('saleId') saleId: string,
    @Body() dto: CreateInternalDocumentDto,
  ) {
    return this.service.createFromSale(user, saleId, dto);
  }

  @Get('internal-documents/:id')
  @RequirePermissions('internal_documents.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Get('internal-documents/:id/print')
  @RequirePermissions('internal_documents.print')
  print(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.print(user, id);
  }

  @Post('internal-documents/:id/void')
  @RequirePermissions('internal_documents.void')
  void(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VoidInternalDocumentDto,
  ) {
    return this.service.void(user, id, dto);
  }

  @Get('sales/:saleId/internal-documents')
  @RequirePermissions('internal_documents.view')
  findBySale(@CurrentUser() user: AuthUser, @Param('saleId') saleId: string) {
    return this.service.findBySale(user, saleId);
  }
}
