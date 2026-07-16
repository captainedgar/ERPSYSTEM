import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequirePlanFeature } from '../common/decorators/require-plan-feature.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CreateElectronicInvoiceDto,
  ElectronicInvoicesQueryDto,
  FiscalSendDto,
} from './dto/electronic-invoice.dto';
import { UpdateFiscalSettingsDto } from './dto/update-fiscal-settings.dto';
import { FiscalService } from './fiscal.service';

@Controller('fiscal')
@RequirePlanFeature('fiscal_mock')
export class FiscalController {
  constructor(private readonly service: FiscalService) {}

  @Get('settings')
  @RequirePermissions('fiscal.settings.view')
  getSettings(@CurrentUser() user: AuthUser) {
    return this.service.getSettings(user);
  }

  @Put('settings')
  @RequirePermissions('fiscal.settings.update')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateFiscalSettingsDto,
  ) {
    return this.service.updateSettings(user, dto);
  }

  @Get('providers')
  @RequirePermissions('fiscal.providers.view')
  listProviders(@CurrentUser() user: AuthUser) {
    return this.service.listProviders(user);
  }

  @Post('providers/mock/enable')
  @RequirePermissions('fiscal.providers.configure')
  enableMockProvider(@CurrentUser() user: AuthUser) {
    return this.service.enableMockProvider(user);
  }

  @Post('providers/:providerId/test-connection')
  @RequirePermissions('fiscal.providers.configure')
  testConnection(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    return this.service.testConnection(user, providerId);
  }

  @Post('electronic-invoices/from-sale/:saleId')
  @RequirePermissions('fiscal.documents.create')
  createFromSale(
    @CurrentUser() user: AuthUser,
    @Param('saleId') saleId: string,
    @Body() dto: CreateElectronicInvoiceDto,
  ) {
    return this.service.createFromSale(user, saleId, dto);
  }

  @Post('electronic-invoices/from-internal-document/:internalDocumentId')
  @RequirePermissions('fiscal.documents.create')
  createFromInternalDocument(
    @CurrentUser() user: AuthUser,
    @Param('internalDocumentId') internalDocumentId: string,
    @Body() dto: CreateElectronicInvoiceDto,
  ) {
    return this.service.createFromInternalDocument(
      user,
      internalDocumentId,
      dto,
    );
  }

  @Get('electronic-invoices')
  @RequirePermissions('fiscal.documents.view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ElectronicInvoicesQueryDto,
  ) {
    return this.service.findAll(user, query);
  }

  @Get('electronic-invoices/:id')
  @RequirePermissions('fiscal.documents.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post('electronic-invoices/:id/send')
  @RequirePermissions('fiscal.documents.send')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FiscalSendDto,
  ) {
    return this.service.send(user, id, dto);
  }

  @Post('electronic-invoices/:id/retry')
  @RequirePermissions('fiscal.documents.retry')
  retry(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FiscalSendDto,
  ) {
    return this.service.retry(user, id, dto);
  }

  @Get('electronic-invoices/:id/status')
  @RequirePermissions('fiscal.documents.view')
  checkStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.checkStatus(user, id);
  }

  @Get('electronic-invoices/:id/events')
  @RequirePermissions('fiscal.documents.view_events')
  events(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.events(user, id);
  }

  @Get('electronic-invoices/:id/errors')
  @RequirePermissions('fiscal.documents.view_errors')
  errors(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.errors(user, id);
  }
}
