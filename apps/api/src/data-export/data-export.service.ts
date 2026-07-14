import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import ExcelJS from 'exceljs';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  DataExportQueryDto,
  ExportFormat,
  ExportScope,
} from './dto/data-export-query.dto';

type ExportRow = Record<string, string | number | boolean | Date | null>;
type ExportKind =
  | 'products'
  | 'inventory'
  | 'customers'
  | 'sales'
  | 'sales_items'
  | 'cash'
  | 'inventory_movements'
  | 'inventory_transfers'
  | 'internal_documents'
  | 'reports_overview';

interface ExportFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const labels: Record<ExportKind, string> = {
  products: 'productos',
  inventory: 'inventario',
  customers: 'clientes',
  sales: 'ventas',
  sales_items: 'detalle_ventas',
  cash: 'caja',
  inventory_movements: 'movimientos_inventario',
  inventory_transfers: 'transferencias',
  internal_documents: 'documentos_internos',
  reports_overview: 'resumen_reportes',
};

const auditActions: Record<ExportKind | 'backup', string> = {
  products: 'DATA_EXPORT_PRODUCTS',
  inventory: 'DATA_EXPORT_INVENTORY',
  customers: 'DATA_EXPORT_CUSTOMERS',
  sales: 'DATA_EXPORT_SALES',
  sales_items: 'DATA_EXPORT_SALES',
  cash: 'DATA_EXPORT_CASH',
  inventory_movements: 'DATA_EXPORT_INVENTORY_MOVEMENTS',
  inventory_transfers: 'DATA_EXPORT_INVENTORY_TRANSFERS',
  internal_documents: 'DATA_EXPORT_INTERNAL_DOCUMENTS',
  reports_overview: 'DATA_EXPORT_REPORTS_OVERVIEW',
  backup: 'DATA_EXPORT_BACKUP_GENERATED',
};

@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async exportKind(
    user: AuthUser,
    kind: ExportKind,
    query: DataExportQueryDto,
  ) {
    const context = this.context(user, query);
    const rows = await this.rows(user, kind, context);
    await this.auditExport(user, kind, query, context.branchId, rows.length);
    return this.file(kind, query.format ?? ExportFormat.XLSX, rows);
  }

  async backup(user: AuthUser, query: DataExportQueryDto) {
    const context = this.context(user, {
      ...query,
      format: ExportFormat.XLSX,
      scope: query.scope ?? ExportScope.ACTIVE_BRANCH,
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Comercia ERP';
    workbook.created = new Date();

    const kinds: ExportKind[] = [
      'products',
      'inventory',
      'customers',
      'sales',
      'sales_items',
      'cash',
      'inventory_movements',
      'inventory_transfers',
      'internal_documents',
    ];
    let totalRows = 0;
    for (const kind of kinds) {
      const rows = await this.rows(user, kind, context);
      totalRows += rows.length;
      this.addSheet(workbook, this.sheetName(kind), rows);
    }
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { name: true },
    });
    this.addSheet(workbook, 'Metadata', [
      {
        companyName: company.name,
        generatedAt: new Date().toISOString(),
        generatedBy: user.userId,
        scope: context.scope,
        branchId: context.branchId ?? null,
        formatVersion: '1.0',
      },
    ]);
    await this.auditExport(user, 'backup', query, context.branchId, totalRows);
    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: this.filename('backup', ExportFormat.XLSX),
    };
  }

  private async rows(
    user: AuthUser,
    kind: ExportKind,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    switch (kind) {
      case 'products':
        return this.products(user);
      case 'inventory':
        return this.inventory(user, context);
      case 'customers':
        return this.customers(user);
      case 'sales':
        return this.sales(user, context);
      case 'sales_items':
        return this.salesItems(user, context);
      case 'cash':
        return this.cash(user, context);
      case 'inventory_movements':
        return this.inventoryMovements(user, context);
      case 'inventory_transfers':
        return this.inventoryTransfers(user, context);
      case 'internal_documents':
        return this.internalDocuments(user, context);
      case 'reports_overview':
        return this.reportsOverview(user, context);
    }
  }

  private async products(user: AuthUser): Promise<ExportRow[]> {
    const products = await this.prisma.product.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        unit: { select: { name: true, code: true } },
        compatibilityGroups: { include: { group: true } },
        alternativeCodes: true,
        substitutes: {
          include: { substituteProduct: { select: { name: true, sku: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return products.map((product) => ({
      Nombre: product.name,
      SKU: product.sku,
      'Codigo de barras': product.barcode,
      Categoria: product.category?.name ?? null,
      Marca: product.brand?.name ?? null,
      Unidad: product.unit?.name ?? product.unit?.code ?? null,
      Precio: Number(product.price),
      Costo: Number(product.cost),
      ITBIS: Number(product.taxRate),
      Estado: product.status,
      'Stock global heredado': Number(product.stock),
      'Fecha creacion': product.createdAt,
      'Fecha actualizacion': product.updatedAt,
      'Grupo compatibilidad': product.compatibilityGroups
        .map((item) => item.group.code)
        .join(', '),
      'Codigos alternos/OEM': product.alternativeCodes
        .map((item) => `${item.type}:${item.code}`)
        .join(', '),
      Sustitutos: product.substitutes
        .map(
          (item) => item.substituteProduct.sku ?? item.substituteProduct.name,
        )
        .join(', '),
    }));
  }

  private async inventory(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const stocks = await this.prisma.productBranchStock.findMany({
      where: {
        companyId: user.companyId,
        branchId: context.branchId ?? undefined,
        product: { deletedAt: null },
      },
      include: {
        branch: { select: { name: true, code: true } },
        product: {
          include: {
            category: { select: { name: true } },
            brand: { select: { name: true } },
          },
        },
      },
      orderBy: [{ branch: { name: 'asc' } }, { product: { name: 'asc' } }],
    });
    return stocks.map((stock) => ({
      Sucursal: `${stock.branch.name} (${stock.branch.code})`,
      Producto: stock.product.name,
      SKU: stock.product.sku,
      'Codigo de barras': stock.product.barcode,
      Categoria: stock.product.category?.name ?? null,
      Marca: stock.product.brand?.name ?? null,
      'Stock en sucursal': Number(stock.quantity),
      'Stock minimo en sucursal': Number(stock.minStock),
      Estado: stockStatus(stock.quantity, stock.minStock),
      'Ultima actualizacion': stock.updatedAt,
    }));
  }

  private async customers(user: AuthUser): Promise<ExportRow[]> {
    const customers = await this.prisma.customer.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return customers.map((customer) => ({
      Nombre: customer.name,
      'Nombre comercial': customer.commercialName,
      Tipo: customer.type,
      Documento: customer.documentNumber,
      Email: customer.email,
      Telefono: customer.phone,
      Movil: customer.mobile,
      Direccion: customer.address,
      Ciudad: customer.city,
      Provincia: customer.province,
      'Tipo contribuyente': customer.taxpayerType,
      'Limite de credito': Number(customer.creditLimit),
      'Dias credito': customer.paymentTermsDays,
      Estado: customer.status,
      'Fecha creacion': customer.createdAt,
    }));
  }

  private async sales(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const sales = await this.prisma.sale.findMany({
      where: this.saleWhere(user, context),
      include: {
        branch: { select: { name: true } },
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return sales.map((sale) => ({
      'Numero venta': sale.saleNumber,
      Fecha: sale.createdAt,
      Sucursal: sale.branch.name,
      Cliente: sale.customer?.name ?? 'Consumidor final',
      Usuario: sale.createdBy.name,
      Estado: sale.status,
      Subtotal: Number(sale.subtotal),
      Descuento: Number(sale.discountTotal),
      ITBIS: Number(sale.taxTotal),
      Total: Number(sale.total),
      Pagado: Number(sale.paidTotal),
      Balance: Number(sale.balanceDue),
      'Metodo de pago': sale.payments
        .map((payment) => payment.method)
        .join(', '),
    }));
  }

  private async salesItems(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const items = await this.prisma.saleItem.findMany({
      where: { companyId: user.companyId, sale: this.saleWhere(user, context) },
      include: {
        product: { select: { sku: true } },
        service: { select: { name: true } },
        sale: { include: { branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => ({
      'Numero venta': item.sale.saleNumber,
      Fecha: item.sale.createdAt,
      Sucursal: item.sale.branch.name,
      'Producto/Servicio': item.name,
      SKU: item.product?.sku ?? null,
      Cantidad: Number(item.quantity),
      'Precio unitario': Number(item.unitPrice),
      Descuento: Number(item.discountAmount),
      ITBIS: Number(item.taxTotal),
      'Total linea': Number(item.total),
    }));
  }

  private async cash(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        companyId: user.companyId,
        branchId: context.branchId ?? undefined,
        openedAt: { gte: context.from, lte: context.to },
      },
      include: {
        branch: { select: { name: true } },
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
    return sessions.map((session) => ({
      Sucursal: session.branch.name,
      Sesion: session.id,
      'Fecha apertura': session.openedAt,
      'Fecha cierre': session.closedAt,
      'Usuario apertura': session.openedBy.name,
      'Usuario cierre': session.closedBy?.name ?? null,
      'Monto apertura': Number(session.openingAmount),
      'Ventas efectivo': Number(session.salesCashTotal),
      'Entradas manuales': Number(session.manualInTotal),
      'Salidas manuales': Number(session.manualOutTotal),
      Esperado: Number(session.expectedCashAmount),
      Contado:
        session.countedCashAmount === null
          ? null
          : Number(session.countedCashAmount),
      Diferencia:
        session.differenceAmount === null
          ? null
          : Number(session.differenceAmount),
      Estado: session.status,
    }));
  }

  private async inventoryMovements(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        companyId: user.companyId,
        branchId: context.branchId ?? undefined,
        createdAt: { gte: context.from, lte: context.to },
      },
      include: {
        branch: { select: { name: true } },
        product: { select: { name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return movements.map((movement) => ({
      Fecha: movement.createdAt,
      Sucursal: movement.branch.name,
      Producto: movement.product.name,
      SKU: movement.product.sku,
      'Tipo movimiento': movement.type,
      Cantidad: Number(movement.quantity),
      'Stock anterior': Number(movement.previousStock),
      'Stock nuevo': Number(movement.newStock),
      Referencia: [movement.referenceType, movement.referenceId]
        .filter(Boolean)
        .join(':'),
      Razon: movement.reason,
      Usuario: movement.createdBy.name,
    }));
  }

  private async inventoryTransfers(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const transfers = await this.prisma.inventoryTransferItem.findMany({
      where: {
        companyId: user.companyId,
        transfer: {
          createdAt: { gte: context.from, lte: context.to },
          OR: context.branchId
            ? [
                { fromBranchId: context.branchId },
                { toBranchId: context.branchId },
              ]
            : undefined,
        },
      },
      include: {
        product: { select: { name: true, sku: true } },
        transfer: {
          include: {
            fromBranch: { select: { name: true } },
            toBranch: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return transfers.map((item) => ({
      Fecha: item.transfer.createdAt,
      'Sucursal origen': item.transfer.fromBranch.name,
      'Sucursal destino': item.transfer.toBranch.name,
      Producto: item.product.name,
      SKU: item.product.sku,
      Cantidad: Number(item.quantity),
      Estado: item.transfer.status,
      Nota: item.transfer.note,
      Usuario: item.transfer.createdBy?.name ?? null,
    }));
  }

  private async internalDocuments(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const docs = await this.prisma.internalDocument.findMany({
      where: {
        companyId: user.companyId,
        branchId: context.branchId ?? undefined,
        createdAt: { gte: context.from, lte: context.to },
      },
      include: {
        branch: { select: { name: true } },
        customer: { select: { name: true } },
        sale: { select: { saleNumber: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((doc) => ({
      'Numero documento': doc.documentNumber,
      Tipo: doc.documentType,
      Estado: doc.status,
      Fecha: doc.createdAt,
      Sucursal: doc.branch.name,
      Cliente: doc.customer?.name ?? 'Consumidor final',
      'Venta relacionada': doc.sale?.saleNumber ?? null,
      Subtotal: Number(doc.subtotal),
      ITBIS: Number(doc.taxTotal),
      Total: Number(doc.total),
      Usuario: doc.createdBy.name,
    }));
  }

  private async reportsOverview(
    user: AuthUser,
    context: ExportContext,
  ): Promise<ExportRow[]> {
    const [sales, customers, documents, lowStock] = await Promise.all([
      this.prisma.sale.aggregate({
        where: this.saleWhere(user, context),
        _count: { _all: true },
        _sum: { total: true, paidTotal: true, balanceDue: true },
      }),
      this.prisma.customer.count({
        where: { companyId: user.companyId, deletedAt: null },
      }),
      this.prisma.internalDocument.count({
        where: {
          companyId: user.companyId,
          branchId: context.branchId ?? undefined,
          createdAt: { gte: context.from, lte: context.to },
        },
      }),
      this.prisma.productBranchStock.count({
        where: {
          companyId: user.companyId,
          branchId: context.branchId ?? undefined,
          quantity: { lte: this.prisma.productBranchStock.fields.minStock },
          product: { deletedAt: null, trackInventory: true },
        },
      }),
    ]);
    return [
      {
        Desde: context.from,
        Hasta: context.to,
        Sucursal: context.branchId ?? 'Todas',
        Ventas: sales._count._all,
        'Total vendido': Number(sales._sum.total ?? 0),
        'Total pagado': Number(sales._sum.paidTotal ?? 0),
        'Balance pendiente': Number(sales._sum.balanceDue ?? 0),
        Clientes: customers,
        Documentos: documents,
        'Productos bajo stock': lowStock,
      },
    ];
  }

  private async file(
    kind: ExportKind,
    format: ExportFormat,
    rows: ExportRow[],
  ): Promise<ExportFile> {
    if (format === ExportFormat.CSV) {
      return {
        buffer: Buffer.from(toCsv(rows), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        filename: this.filename(kind, format),
      };
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Comercia ERP';
    this.addSheet(workbook, this.sheetName(kind), rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: this.filename(kind, format),
    };
  }

  private addSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    rows: ExportRow[],
  ) {
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    const columns = Object.keys(rows[0] ?? { Mensaje: 'Sin datos' });
    sheet.columns = columns.map((key) => ({
      header: key,
      key,
      width: Math.min(Math.max(key.length + 4, 14), 36),
    }));
    for (const row of rows.length ? rows : [{ Mensaje: 'Sin datos' }]) {
      sheet.addRow(row);
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private saleWhere(
    user: AuthUser,
    context: ExportContext,
  ): Prisma.SaleWhereInput {
    return {
      companyId: user.companyId,
      branchId: context.branchId ?? undefined,
      createdAt: { gte: context.from, lte: context.to },
    };
  }

  private context(user: AuthUser, query: DataExportQueryDto): ExportContext {
    const scope = query.scope ?? ExportScope.ACTIVE_BRANCH;
    if (scope === ExportScope.ALL_BRANCHES && !canExportAllBranches(user)) {
      throw new ForbiddenException(
        'No tienes permiso para exportar todas las sucursales',
      );
    }
    return {
      from: parseBoundary(query.from, false),
      to: parseBoundary(query.to, true),
      branchId:
        scope === ExportScope.ALL_BRANCHES
          ? query.branchId
          : (query.branchId ?? user.branchId ?? undefined),
      scope,
    };
  }

  private async auditExport(
    user: AuthUser,
    kind: ExportKind | 'backup',
    query: DataExportQueryDto,
    branchId: string | undefined,
    rowCount: number,
  ) {
    await this.audit.create({
      companyId: user.companyId,
      branchId: branchId ?? user.branchId,
      userId: user.userId,
      action: auditActions[kind],
      module: 'data_export',
      entityType: 'DataExport',
      description: `Exportacion ${kind}`,
      metadata: {
        type: kind,
        format: query.format ?? ExportFormat.XLSX,
        scope: query.scope ?? ExportScope.ACTIVE_BRANCH,
        from: query.from ?? null,
        to: query.to ?? null,
        branchId: branchId ?? null,
        rowCount,
      },
    });
  }

  private filename(kind: ExportKind | 'backup', format: ExportFormat) {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = format === ExportFormat.CSV ? 'csv' : 'xlsx';
    const label = kind === 'backup' ? 'backup' : labels[kind];
    return `comercia_${label}_${date}.${suffix}`;
  }

  private sheetName(kind: ExportKind) {
    return labels[kind].replace(/_/g, ' ');
  }
}

interface ExportContext {
  from: Date;
  to: Date;
  branchId?: string;
  scope: ExportScope;
}

function canExportAllBranches(user: AuthUser) {
  return user.roleCode === UserRole.OWNER || user.roleCode === UserRole.ADMIN;
}

function parseBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value) {
    const date = new Date();
    date.setUTCFullYear(
      endOfDay ? 3000 : 1970,
      endOfDay ? 11 : 0,
      endOfDay ? 31 : 1,
    );
    date.setUTCHours(
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
    return date;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Rango de fechas invalido');
  }
  return parsed;
}

function stockStatus(quantity: Prisma.Decimal, minStock: Prisma.Decimal) {
  if (quantity.lessThanOrEqualTo(0)) return 'Sin stock';
  if (quantity.lessThanOrEqualTo(minStock)) return 'Bajo stock';
  return 'Disponible';
}

function toCsv(rows: ExportRow[]) {
  const columns = Object.keys(rows[0] ?? { Mensaje: 'Sin datos' });
  const body = (rows.length ? rows : [{ Mensaje: 'Sin datos' }]).map((row) =>
    columns.map((column) => csvCell(row[column])).join(','),
  );
  return ['\uFEFF' + columns.map(csvCell).join(','), ...body].join('\r\n');
}

function csvCell(value: ExportRow[string] | undefined) {
  const text =
    value instanceof Date
      ? value.toISOString()
      : value === null || value === undefined
        ? ''
        : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
