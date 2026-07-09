import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ElectronicDocumentType,
  ElectronicInvoiceStatus,
  FiscalEnvironment,
  FiscalProviderMode,
  FiscalProviderStatus,
  InternalDocumentStatus,
  Prisma,
  SaleStatus,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { MockFiscalProviderAdapter } from './adapters/mock-fiscal-provider.adapter';
import {
  CreateElectronicInvoiceDto,
  ElectronicInvoicesQueryDto,
  FiscalSendDto,
} from './dto/electronic-invoice.dto';
import { UpdateFiscalSettingsDto } from './dto/update-fiscal-settings.dto';

const fiscalInvoiceInclude = {
  sale: { select: { id: true, saleNumber: true, status: true } },
  internalDocument: {
    select: {
      id: true,
      documentNumber: true,
      documentType: true,
      status: true,
    },
  },
  customer: { select: { id: true, name: true, documentNumber: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ElectronicInvoiceInclude;

@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mockProvider: MockFiscalProviderAdapter,
  ) {}

  getSettings(user: AuthUser) {
    return this.ensureSettings(user.companyId);
  }

  async updateSettings(user: AuthUser, dto: UpdateFiscalSettingsDto) {
    if (dto.environment === FiscalEnvironment.PRODUCTION) {
      throw new BadRequestException(
        'PRODUCTION no esta disponible en esta fase fiscal',
      );
    }
    if (dto.providerMode === FiscalProviderMode.PROVIDER) {
      throw new BadRequestException(
        'Los proveedores reales no estan disponibles en esta fase fiscal',
      );
    }
    const settings = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fiscalSettings.upsert({
        where: { companyId: user.companyId },
        update: {
          rnc: this.optional(dto.rnc),
          legalName: this.optional(dto.legalName),
          commercialName: this.optional(dto.commercialName),
          economicActivity: this.optional(dto.economicActivity),
          fiscalAddress: this.optional(dto.fiscalAddress),
          province: this.optional(dto.province),
          municipality: this.optional(dto.municipality),
          environment: FiscalEnvironment.SANDBOX,
          providerMode: FiscalProviderMode.MOCK,
          enabled: dto.enabled,
        },
        create: {
          companyId: user.companyId,
          rnc: this.optional(dto.rnc),
          legalName: this.optional(dto.legalName),
          commercialName: this.optional(dto.commercialName),
          economicActivity: this.optional(dto.economicActivity),
          fiscalAddress: this.optional(dto.fiscalAddress),
          province: this.optional(dto.province),
          municipality: this.optional(dto.municipality),
          environment: FiscalEnvironment.SANDBOX,
          providerMode: FiscalProviderMode.MOCK,
          enabled: dto.enabled ?? false,
        },
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'FISCAL_SETTINGS_UPDATED',
        module: 'fiscal',
        entityType: 'FiscalSettings',
        entityId: updated.id,
        description: 'Configuracion fiscal actualizada en modo sandbox/mock',
        metadata: {
          environment: updated.environment,
          providerMode: updated.providerMode,
        },
      });
      return updated;
    });
    return settings;
  }

  listProviders(user: AuthUser) {
    return this.prisma.fiscalProvider.findMany({
      where: { companyId: user.companyId },
      include: {
        credentials: { select: { id: true, keyName: true, createdAt: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async enableMockProvider(user: AuthUser) {
    const provider = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.fiscalProvider.upsert({
        where: {
          companyId_code: {
            companyId: user.companyId,
            code: 'MOCK_SANDBOX',
          },
        },
        update: {
          name: 'Proveedor fiscal mock',
          mode: FiscalProviderMode.MOCK,
          status: FiscalProviderStatus.ACTIVE,
          baseUrl: null,
        },
        create: {
          companyId: user.companyId,
          name: 'Proveedor fiscal mock',
          code: 'MOCK_SANDBOX',
          mode: FiscalProviderMode.MOCK,
          status: FiscalProviderStatus.ACTIVE,
        },
      });
      await tx.fiscalProviderCredential.upsert({
        where: {
          providerId_keyName: {
            providerId: saved.id,
            keyName: 'MOCK_API_KEY',
          },
        },
        update: { encryptedValue: 'mock-placeholder-no-secret' },
        create: {
          companyId: user.companyId,
          providerId: saved.id,
          keyName: 'MOCK_API_KEY',
          encryptedValue: 'mock-placeholder-no-secret',
        },
      });
      await tx.fiscalSettings.upsert({
        where: { companyId: user.companyId },
        update: {
          environment: FiscalEnvironment.SANDBOX,
          providerMode: FiscalProviderMode.MOCK,
          activeProviderId: saved.id,
          enabled: true,
        },
        create: {
          companyId: user.companyId,
          environment: FiscalEnvironment.SANDBOX,
          providerMode: FiscalProviderMode.MOCK,
          activeProviderId: saved.id,
          enabled: true,
        },
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'FISCAL_PROVIDER_ENABLED',
        module: 'fiscal',
        entityType: 'FiscalProvider',
        entityId: saved.id,
        description: 'Proveedor fiscal mock habilitado',
        metadata: { providerCode: saved.code },
      });
      return saved;
    });
    return provider;
  }

  async testConnection(user: AuthUser, providerId: string) {
    const provider = await this.prisma.fiscalProvider.findFirst({
      where: { id: providerId, companyId: user.companyId },
    });
    if (!provider)
      throw new NotFoundException('Proveedor fiscal no encontrado');
    if (provider.mode !== FiscalProviderMode.MOCK) {
      throw new BadRequestException(
        'Solo el proveedor mock esta disponible en esta fase',
      );
    }
    const result = await this.mockProvider.testConnection();
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'FISCAL_PROVIDER_TESTED',
      module: 'fiscal',
      entityType: 'FiscalProvider',
      entityId: provider.id,
      description: 'Conexion mock fiscal probada',
      metadata: result,
    });
    return result;
  }

  async createFromSale(
    user: AuthUser,
    saleId: string,
    dto: CreateElectronicInvoiceDto,
  ) {
    const invoiceId = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, companyId: user.companyId },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          customer: true,
          items: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException(
          'Solo se pueden crear borradores fiscales desde ventas completadas',
        );
      }
      const settings = await this.ensureSettingsWithClient(tx, user.companyId);
      const invoice = await tx.electronicInvoice.create({
        data: {
          companyId: user.companyId,
          branchId: sale.branchId,
          saleId: sale.id,
          customerId: sale.customerId,
          documentType:
            dto.documentType ?? ElectronicDocumentType.INTERNAL_TEST,
          status: ElectronicInvoiceStatus.DRAFT,
          payload: this.salePayload(settings, sale),
          createdById: user.userId,
        },
        select: { id: true },
      });
      await this.recordEvent(
        tx,
        user.companyId,
        invoice.id,
        'ELECTRONIC_INVOICE_DRAFT_CREATED',
        'Borrador fiscal creado desde venta',
        { saleId: sale.id, saleNumber: sale.saleNumber },
      );
      await this.auditDraft(tx, user, invoice.id, sale.branchId, {
        source: 'sale',
        saleId: sale.id,
        saleNumber: sale.saleNumber,
      });
      return invoice.id;
    });
    return this.findOne(user, invoiceId);
  }

  async createFromInternalDocument(
    user: AuthUser,
    internalDocumentId: string,
    dto: CreateElectronicInvoiceDto,
  ) {
    const invoiceId = await this.prisma.$transaction(async (tx) => {
      const document = await tx.internalDocument.findFirst({
        where: { id: internalDocumentId, companyId: user.companyId },
        include: {
          branch: { select: { id: true, code: true, name: true } },
          customer: true,
          sale: { select: { id: true, saleNumber: true, status: true } },
          items: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!document)
        throw new NotFoundException('Documento interno no encontrado');
      if (document.status === InternalDocumentStatus.VOIDED) {
        throw new BadRequestException(
          'No se puede crear un borrador fiscal desde un documento anulado',
        );
      }
      const settings = await this.ensureSettingsWithClient(tx, user.companyId);
      const invoice = await tx.electronicInvoice.create({
        data: {
          companyId: user.companyId,
          branchId: document.branchId,
          saleId: document.saleId,
          internalDocumentId: document.id,
          customerId: document.customerId,
          documentType:
            dto.documentType ?? ElectronicDocumentType.INTERNAL_TEST,
          status: ElectronicInvoiceStatus.DRAFT,
          payload: this.internalDocumentPayload(settings, document),
          createdById: user.userId,
        },
        select: { id: true },
      });
      await this.recordEvent(
        tx,
        user.companyId,
        invoice.id,
        'ELECTRONIC_INVOICE_DRAFT_CREATED',
        'Borrador fiscal creado desde documento interno',
        {
          internalDocumentId: document.id,
          documentNumber: document.documentNumber,
        },
      );
      await this.auditDraft(tx, user, invoice.id, document.branchId, {
        source: 'internal_document',
        internalDocumentId: document.id,
        documentNumber: document.documentNumber,
      });
      return invoice.id;
    });
    return this.findOne(user, invoiceId);
  }

  async findAll(user: AuthUser, query: ElectronicInvoicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ElectronicInvoiceWhereInput = {
      companyId: user.companyId,
      status: query.status,
      documentType: query.documentType,
      saleId: query.saleId,
      internalDocumentId: query.internalDocumentId,
      OR: search
        ? [
            { fiscalNumber: { contains: search, mode: 'insensitive' } },
            { providerTrackId: { contains: search, mode: 'insensitive' } },
            { sale: { saleNumber: { contains: search, mode: 'insensitive' } } },
            {
              internalDocument: {
                documentNumber: { contains: search, mode: 'insensitive' },
              },
            },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.electronicInvoice.findMany({
        where,
        include: fiscalInvoiceInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.electronicInvoice.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(user: AuthUser, id: string) {
    const invoice = await this.prisma.electronicInvoice.findFirst({
      where: { id, companyId: user.companyId },
      include: fiscalInvoiceInclude,
    });
    if (!invoice)
      throw new NotFoundException('Documento fiscal interno no encontrado');
    return invoice;
  }

  async send(user: AuthUser, id: string, dto: FiscalSendDto) {
    return this.dispatch(user, id, dto, false);
  }

  async retry(user: AuthUser, id: string, dto: FiscalSendDto) {
    return this.dispatch(user, id, dto, true);
  }

  async checkStatus(user: AuthUser, id: string) {
    const invoiceId = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.electronicInvoice.findFirst({
        where: { id, companyId: user.companyId },
      });
      if (!invoice)
        throw new NotFoundException('Documento fiscal interno no encontrado');
      const result = await this.mockProvider.getStatus({
        invoiceId: invoice.id,
        documentType: invoice.documentType,
        payload: invoice.payload,
      });
      await this.applyProviderResult(tx, user, invoice, result, {
        eventType: 'FISCAL_STATUS_CHECKED',
        message: 'Estado fiscal consultado en proveedor mock',
        auditAction: 'FISCAL_STATUS_CHECKED',
      });
      return invoice.id;
    });
    return this.findOne(user, invoiceId);
  }

  async events(user: AuthUser, id: string) {
    await this.ensureInvoice(user, id);
    return this.prisma.electronicInvoiceEvent.findMany({
      where: { companyId: user.companyId, electronicInvoiceId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async errors(user: AuthUser, id: string) {
    await this.ensureInvoice(user, id);
    return this.prisma.fiscalError.findMany({
      where: { companyId: user.companyId, electronicInvoiceId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async dispatch(
    user: AuthUser,
    id: string,
    dto: FiscalSendDto,
    isRetry: boolean,
  ) {
    const invoiceId = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.electronicInvoice.findFirst({
        where: { id, companyId: user.companyId },
      });
      if (!invoice)
        throw new NotFoundException('Documento fiscal interno no encontrado');
      const allowed = isRetry
        ? this.isRetryable(invoice.status)
        : this.isSendable(invoice.status);
      if (!allowed) {
        throw new BadRequestException(
          isRetry
            ? 'Solo se pueden reintentar documentos fallidos o rechazados'
            : 'Solo se pueden enviar borradores o documentos fallidos/rechazados',
        );
      }
      await this.ensureMockProviderConfigured(tx, user.companyId);
      if (isRetry) {
        await this.recordEvent(
          tx,
          user.companyId,
          invoice.id,
          'ELECTRONIC_INVOICE_RETRIED',
          'Reintento fiscal solicitado',
          { previousStatus: invoice.status },
        );
        await this.audit.createWithClient(tx, {
          companyId: user.companyId,
          branchId: invoice.branchId,
          userId: user.userId,
          action: 'ELECTRONIC_INVOICE_RETRIED',
          module: 'fiscal',
          entityType: 'ElectronicInvoice',
          entityId: invoice.id,
          description: 'Documento fiscal interno reintentado',
          metadata: { previousStatus: invoice.status },
        });
      }
      const result = isRetry
        ? await this.mockProvider.retry({
            invoiceId: invoice.id,
            documentType: invoice.documentType,
            payload: invoice.payload,
            mockOutcome: dto.mockOutcome,
          })
        : await this.mockProvider.sendInvoice({
            invoiceId: invoice.id,
            documentType: invoice.documentType,
            payload: invoice.payload,
            mockOutcome: dto.mockOutcome,
          });
      await this.applyProviderResult(tx, user, invoice, result, {
        eventType: 'ELECTRONIC_INVOICE_SENT',
        message: 'Documento fiscal enviado al proveedor mock',
        auditAction: 'ELECTRONIC_INVOICE_SENT',
      });
      return invoice.id;
    });
    return this.findOne(user, invoiceId);
  }

  private async applyProviderResult(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    invoice: {
      id: string;
      branchId: string;
      status: ElectronicInvoiceStatus;
    },
    result: {
      status: ElectronicInvoiceStatus;
      providerDocumentId: string | null;
      providerTrackId: string | null;
      fiscalNumber: string | null;
      response: Prisma.InputJsonValue;
      errorCode?: string;
      errorMessage?: string;
    },
    source: { eventType: string; message: string; auditAction: string },
  ) {
    const now = new Date();
    await tx.electronicInvoice.update({
      where: { id: invoice.id },
      data: {
        status: result.status,
        providerDocumentId: result.providerDocumentId,
        providerTrackId: result.providerTrackId,
        fiscalNumber: result.fiscalNumber,
        response: result.response,
        errorMessage: result.errorMessage,
        sentAt:
          source.auditAction === 'ELECTRONIC_INVOICE_SENT' ? now : undefined,
        acceptedAt:
          result.status === ElectronicInvoiceStatus.ACCEPTED ? now : undefined,
        rejectedAt:
          result.status === ElectronicInvoiceStatus.REJECTED ? now : undefined,
      },
    });
    await this.recordEvent(
      tx,
      user.companyId,
      invoice.id,
      source.eventType,
      source.message,
      {
        status: result.status,
        providerTrackId: result.providerTrackId,
      },
    );
    await this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId: invoice.branchId,
      userId: user.userId,
      action: source.auditAction,
      module: 'fiscal',
      entityType: 'ElectronicInvoice',
      entityId: invoice.id,
      description: source.message,
      metadata: {
        status: result.status,
        providerTrackId: result.providerTrackId,
      },
    });
    if (result.status === ElectronicInvoiceStatus.ACCEPTED) {
      await this.recordEvent(
        tx,
        user.companyId,
        invoice.id,
        'ELECTRONIC_INVOICE_ACCEPTED',
        'Proveedor mock acepto el documento',
        result.response,
      );
      await this.auditStatus(
        tx,
        user,
        invoice,
        'ELECTRONIC_INVOICE_ACCEPTED',
        result,
      );
    }
    if (result.status === ElectronicInvoiceStatus.REJECTED) {
      await this.recordEvent(
        tx,
        user.companyId,
        invoice.id,
        'ELECTRONIC_INVOICE_REJECTED',
        'Proveedor mock rechazo el documento',
        result.response,
      );
      await this.auditStatus(
        tx,
        user,
        invoice,
        'ELECTRONIC_INVOICE_REJECTED',
        result,
      );
      await this.registerError(tx, user, invoice, result);
    }
    if (result.status === ElectronicInvoiceStatus.FAILED) {
      await this.recordEvent(
        tx,
        user.companyId,
        invoice.id,
        'ELECTRONIC_INVOICE_FAILED',
        'Proveedor mock fallo el envio',
        result.response,
      );
      await this.auditStatus(
        tx,
        user,
        invoice,
        'ELECTRONIC_INVOICE_FAILED',
        result,
      );
      await this.registerError(tx, user, invoice, result);
    }
  }

  private async registerError(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    invoice: { id: string; branchId: string },
    result: {
      errorCode?: string;
      errorMessage?: string;
      response: Prisma.InputJsonValue;
    },
  ) {
    const error = await tx.fiscalError.create({
      data: {
        companyId: user.companyId,
        electronicInvoiceId: invoice.id,
        code: result.errorCode ?? 'MOCK_FISCAL_ERROR',
        message: result.errorMessage ?? 'Error fiscal mock',
        details: result.response,
      },
    });
    await this.recordEvent(
      tx,
      user.companyId,
      invoice.id,
      'FISCAL_ERROR_REGISTERED',
      error.message,
      { code: error.code },
    );
    await this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId: invoice.branchId,
      userId: user.userId,
      action: 'FISCAL_ERROR_REGISTERED',
      module: 'fiscal',
      entityType: 'FiscalError',
      entityId: error.id,
      description: error.message,
      metadata: { electronicInvoiceId: invoice.id, code: error.code },
    });
  }

  private async ensureSettings(companyId: string) {
    return this.ensureSettingsWithClient(this.prisma, companyId);
  }

  private isRetryable(status: ElectronicInvoiceStatus) {
    return (
      status === ElectronicInvoiceStatus.FAILED ||
      status === ElectronicInvoiceStatus.REJECTED
    );
  }

  private isSendable(status: ElectronicInvoiceStatus) {
    return status === ElectronicInvoiceStatus.DRAFT || this.isRetryable(status);
  }

  private ensureSettingsWithClient(
    tx: Prisma.TransactionClient | PrismaService,
    companyId: string,
  ) {
    return tx.fiscalSettings.upsert({
      where: { companyId },
      update: {},
      create: {
        companyId,
        environment: FiscalEnvironment.SANDBOX,
        providerMode: FiscalProviderMode.MOCK,
        enabled: false,
      },
    });
  }

  private async ensureMockProviderConfigured(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    const settings = await tx.fiscalSettings.findUnique({
      where: { companyId },
    });
    if (
      !settings ||
      settings.environment !== FiscalEnvironment.SANDBOX ||
      settings.providerMode !== FiscalProviderMode.MOCK ||
      !settings.activeProviderId
    ) {
      throw new BadRequestException(
        'Debes habilitar el proveedor mock antes de enviar documentos fiscales',
      );
    }
    const provider = await tx.fiscalProvider.findFirst({
      where: {
        id: settings.activeProviderId,
        companyId,
        mode: FiscalProviderMode.MOCK,
        status: FiscalProviderStatus.ACTIVE,
      },
    });
    if (!provider) {
      throw new BadRequestException('Proveedor mock no disponible');
    }
  }

  private async ensureInvoice(user: AuthUser, id: string) {
    const invoice = await this.prisma.electronicInvoice.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true },
    });
    if (!invoice)
      throw new NotFoundException('Documento fiscal interno no encontrado');
  }

  private recordEvent(
    tx: Prisma.TransactionClient,
    companyId: string,
    electronicInvoiceId: string,
    eventType: string,
    message: string,
    payload?: Prisma.InputJsonValue,
  ) {
    return tx.electronicInvoiceEvent.create({
      data: { companyId, electronicInvoiceId, eventType, message, payload },
    });
  }

  private auditDraft(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    invoiceId: string,
    branchId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId,
      userId: user.userId,
      action: 'ELECTRONIC_INVOICE_DRAFT_CREATED',
      module: 'fiscal',
      entityType: 'ElectronicInvoice',
      entityId: invoiceId,
      description: 'Borrador fiscal interno creado',
      metadata,
    });
  }

  private auditStatus(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    invoice: { id: string; branchId: string },
    action: string,
    result: { status: ElectronicInvoiceStatus; providerTrackId: string | null },
  ) {
    return this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId: invoice.branchId,
      userId: user.userId,
      action,
      module: 'fiscal',
      entityType: 'ElectronicInvoice',
      entityId: invoice.id,
      description: `Estado fiscal mock: ${result.status}`,
      metadata: {
        status: result.status,
        providerTrackId: result.providerTrackId,
      },
    });
  }

  private salePayload(
    settings: {
      environment: FiscalEnvironment;
      providerMode: FiscalProviderMode;
      rnc: string | null;
      legalName: string | null;
    },
    sale: Prisma.SaleGetPayload<{
      include: {
        branch: { select: { id: true; code: true; name: true } };
        customer: true;
        items: true;
        payments: true;
      };
    }>,
  ): Prisma.InputJsonValue {
    return {
      source: 'sale',
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      company: {
        environment: settings.environment,
        providerMode: settings.providerMode,
        rnc: settings.rnc,
        legalName: settings.legalName,
      },
      branch: sale.branch,
      customer: sale.customer,
      items: sale.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        subtotal: item.subtotal.toString(),
        taxTotal: item.taxTotal.toString(),
        total: item.total.toString(),
      })),
      payments: sale.payments.map((payment) => ({
        method: payment.method,
        amount: payment.amount.toString(),
      })),
      totals: this.totals(sale),
      sandbox: true,
    };
  }

  private internalDocumentPayload(
    settings: {
      environment: FiscalEnvironment;
      providerMode: FiscalProviderMode;
      rnc: string | null;
      legalName: string | null;
    },
    document: Prisma.InternalDocumentGetPayload<{
      include: {
        branch: { select: { id: true; code: true; name: true } };
        customer: true;
        sale: { select: { id: true; saleNumber: true; status: true } };
        items: true;
      };
    }>,
  ): Prisma.InputJsonValue {
    return {
      source: 'internal_document',
      internalDocumentId: document.id,
      documentNumber: document.documentNumber,
      internalDocumentType: document.documentType,
      sale: document.sale,
      company: {
        environment: settings.environment,
        providerMode: settings.providerMode,
        rnc: settings.rnc,
        legalName: settings.legalName,
      },
      branch: document.branch,
      customer: document.customer,
      items: document.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        subtotal: item.subtotal.toString(),
        taxTotal: item.taxTotal.toString(),
        total: item.total.toString(),
      })),
      totals: this.totals(document),
      sandbox: true,
      disclaimer: 'Documento fiscal mock/sandbox. No es e-CF productivo.',
    };
  }

  private totals(source: {
    subtotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    paidTotal: Prisma.Decimal;
    balanceDue: Prisma.Decimal;
  }) {
    return {
      subtotal: source.subtotal.toString(),
      taxTotal: source.taxTotal.toString(),
      discountTotal: source.discountTotal.toString(),
      total: source.total.toString(),
      paidTotal: source.paidTotal.toString(),
      balanceDue: source.balanceDue.toString(),
    };
  }

  private optional(value: string | undefined) {
    return value?.trim() || undefined;
  }
}
