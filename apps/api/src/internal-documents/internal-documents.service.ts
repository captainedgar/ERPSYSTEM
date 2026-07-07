import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InternalDocumentStatus,
  InternalDocumentType,
  Prisma,
  SaleStatus,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternalDocumentDto } from './dto/create-internal-document.dto';
import { InternalDocumentsQueryDto } from './dto/internal-documents-query.dto';
import { VoidInternalDocumentDto } from './dto/void-internal-document.dto';

export const INTERNAL_DOCUMENT_DISCLAIMER =
  'Documento interno no fiscal. No válido como comprobante fiscal.';

const documentSummaryInclude = {
  customer: { select: { id: true, name: true, documentNumber: true } },
  sale: { select: { id: true, saleNumber: true, status: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InternalDocumentInclude;

const documentDetailInclude = {
  company: {
    select: {
      id: true,
      name: true,
      legalName: true,
      rncOrCedula: true,
      phone: true,
      email: true,
      address: true,
      logoUrl: true,
    },
  },
  branch: {
    select: { id: true, code: true, name: true, phone: true, address: true },
  },
  customer: {
    select: {
      id: true,
      name: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
      address: true,
    },
  },
  sale: {
    select: {
      id: true,
      saleNumber: true,
      status: true,
      createdAt: true,
      cashSessionId: true,
      payments: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          id: true,
          method: true,
          amount: true,
          reference: true,
          notes: true,
          createdAt: true,
        },
      },
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  voidedBy: { select: { id: true, name: true, email: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.InternalDocumentInclude;

@Injectable()
export class InternalDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(user: AuthUser, query: InternalDocumentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.InternalDocumentWhereInput = {
      companyId: user.companyId,
      documentType: query.documentType,
      status: query.status,
      customerId: query.customerId,
      saleId: query.saleId,
      createdAt:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom
                ? this.dateBoundary(query.dateFrom, false)
                : undefined,
              lte: query.dateTo
                ? this.dateBoundary(query.dateTo, true)
                : undefined,
            }
          : undefined,
      OR: search
        ? [
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { sale: { saleNumber: { contains: search, mode: 'insensitive' } } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
            {
              customer: {
                documentNumber: {
                  contains: search.toUpperCase().replace(/[\s-]/g, ''),
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.internalDocument.findMany({
        where,
        include: documentSummaryInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.internalDocument.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findBySale(user: AuthUser, saleId: string) {
    await this.ensureSale(user, saleId);
    return this.prisma.internalDocument.findMany({
      where: { companyId: user.companyId, saleId },
      include: documentSummaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(user: AuthUser, id: string) {
    const document = await this.prisma.internalDocument.findFirst({
      where: { id, companyId: user.companyId },
      include: documentDetailInclude,
    });
    if (!document)
      throw new NotFoundException('Documento interno no encontrado');
    return document;
  }

  async print(user: AuthUser, id: string) {
    const document = await this.findOne(user, id);
    await this.audit.create({
      companyId: user.companyId,
      branchId: document.branchId,
      userId: user.userId,
      action: 'INTERNAL_DOCUMENT_PRINT_VIEWED',
      module: 'internal_documents',
      entityType: 'InternalDocument',
      entityId: document.id,
      description: `Vista imprimible consultada para ${document.documentNumber}`,
      metadata: { documentType: document.documentType },
    });
    return {
      company: document.company,
      branch: document.branch,
      customer: document.customer,
      document: {
        id: document.id,
        documentNumber: document.documentNumber,
        documentType: document.documentType,
        status: document.status,
        createdAt: document.createdAt,
        notes: document.notes,
        sale: document.sale,
      },
      items: document.items,
      payments: document.sale.payments,
      totals: {
        subtotal: document.subtotal,
        taxTotal: document.taxTotal,
        discountTotal: document.discountTotal,
        total: document.total,
        paidTotal: document.paidTotal,
        balanceDue: document.balanceDue,
      },
      disclaimer: INTERNAL_DOCUMENT_DISCLAIMER,
    };
  }

  async createFromSale(
    user: AuthUser,
    saleId: string,
    dto: CreateInternalDocumentDto,
  ) {
    const documentId = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, companyId: user.companyId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException(
          'Solo se pueden documentar ventas completadas',
        );
      }

      const existing = await tx.internalDocument.findFirst({
        where: {
          companyId: user.companyId,
          saleId: sale.id,
          documentType: dto.documentType,
          status: InternalDocumentStatus.ISSUED,
        },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(
          'La venta ya tiene un documento interno activo de este tipo',
        );
      }

      const documentNumber = await this.nextDocumentNumber(
        tx,
        user,
        sale.branchId,
        dto.documentType,
      );
      const document = await tx.internalDocument.create({
        data: {
          companyId: user.companyId,
          branchId: sale.branchId,
          saleId: sale.id,
          customerId: sale.customerId,
          documentNumber,
          documentType: dto.documentType,
          status: InternalDocumentStatus.ISSUED,
          subtotal: sale.subtotal,
          taxTotal: sale.taxTotal,
          discountTotal: sale.discountTotal,
          total: sale.total,
          paidTotal: sale.paidTotal,
          balanceDue: sale.balanceDue,
          notes: this.optional(dto.notes),
          createdById: user.userId,
          items: {
            create: sale.items.map((item) => ({
              companyId: user.companyId,
              saleItemId: item.id,
              itemType: item.itemType,
              productId: item.productId,
              serviceId: item.serviceId,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              discountAmount: item.discountAmount,
              subtotal: item.subtotal,
              taxTotal: item.taxTotal,
              total: item.total,
            })),
          },
        },
        select: { id: true },
      });

      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: sale.branchId,
        userId: user.userId,
        action: 'INTERNAL_DOCUMENT_CREATED',
        module: 'internal_documents',
        entityType: 'InternalDocument',
        entityId: document.id,
        description: `Documento interno ${documentNumber} creado`,
        metadata: {
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          documentType: dto.documentType,
          total: sale.total.toString(),
        },
      });
      return document.id;
    });
    return this.findOne(user, documentId);
  }

  async void(user: AuthUser, id: string, dto: VoidInternalDocumentDto) {
    const documentId = await this.prisma.$transaction(async (tx) => {
      const document = await tx.internalDocument.findFirst({
        where: { id, companyId: user.companyId },
        select: {
          id: true,
          branchId: true,
          saleId: true,
          documentNumber: true,
          documentType: true,
          status: true,
        },
      });
      if (!document) {
        throw new NotFoundException('Documento interno no encontrado');
      }
      if (document.status !== InternalDocumentStatus.ISSUED) {
        throw new BadRequestException(
          'Solo se pueden anular documentos internos emitidos',
        );
      }
      const reason = dto.reason.trim();
      const updated = await tx.internalDocument.updateMany({
        where: {
          id: document.id,
          companyId: user.companyId,
          status: InternalDocumentStatus.ISSUED,
        },
        data: {
          status: InternalDocumentStatus.VOIDED,
          voidedById: user.userId,
          voidedAt: new Date(),
          voidReason: reason,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('El documento ya no puede anularse');
      }
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: document.branchId,
        userId: user.userId,
        action: 'INTERNAL_DOCUMENT_VOIDED',
        module: 'internal_documents',
        entityType: 'InternalDocument',
        entityId: document.id,
        description: `Documento interno ${document.documentNumber} anulado`,
        metadata: {
          saleId: document.saleId,
          documentType: document.documentType,
          reason,
        },
      });
      return document.id;
    });
    return this.findOne(user, documentId);
  }

  private async ensureSale(user: AuthUser, saleId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, companyId: user.companyId },
      select: { id: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    branchId: string,
    documentType: InternalDocumentType,
  ) {
    const lockKey = `${user.companyId}:${branchId}:${documentType}`;
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`,
    );
    const branch = await tx.branch.findFirst({
      where: { id: branchId, companyId: user.companyId },
      select: { code: true },
    });
    if (!branch)
      throw new BadRequestException('La sucursal no esta disponible');
    const prefix = this.defaultPrefix(documentType, branch.code);
    const sequence = await tx.documentSequence.upsert({
      where: {
        companyId_branchId_documentType: {
          companyId: user.companyId,
          branchId,
          documentType,
        },
      },
      update: { nextNumber: { increment: 1 } },
      create: {
        companyId: user.companyId,
        branchId,
        documentType,
        prefix,
        nextNumber: 2,
        padding: 8,
      },
    });
    const issuedNumber = sequence.nextNumber - 1;
    const documentNumber = `${sequence.prefix}${String(issuedNumber).padStart(
      sequence.padding,
      '0',
    )}`;
    await this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId,
      userId: user.userId,
      action: 'DOCUMENT_SEQUENCE_ADVANCED',
      module: 'internal_documents',
      entityType: 'DocumentSequence',
      entityId: sequence.id,
      description: `Secuencia interna avanzada para ${documentType}`,
      metadata: {
        documentType,
        documentNumber,
        nextNumber: sequence.nextNumber,
      },
    });
    return documentNumber;
  }

  private defaultPrefix(
    documentType: InternalDocumentType,
    branchCode: string,
  ) {
    const cleanBranch = branchCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return documentType === InternalDocumentType.RECEIPT
      ? `REC-${cleanBranch}-`
      : `FIN-${cleanBranch}-`;
  }

  private dateBoundary(value: string, endOfDay: boolean) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(
        `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
      );
    }
    return new Date(value);
  }

  private optional(value: string | undefined) {
    return value?.trim() || undefined;
  }
}
