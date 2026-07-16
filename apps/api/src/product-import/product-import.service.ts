import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CatalogStatus,
  CategoryType,
  InventoryMovementType,
  Prisma,
  ProductAlternativeCodeType,
} from '@prisma/client';
import ExcelJS from 'exceljs';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyEntitlementsService } from '../company-entitlements/company-entitlements.service';
import { ProductImportOptionsDto } from './dto/product-import-options.dto';
import type { UploadedExcelFile } from './product-import.types';

type ImportColumn =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'category'
  | 'brand'
  | 'unit'
  | 'cost'
  | 'price'
  | 'stock'
  | 'minStock'
  | 'taxRate'
  | 'active'
  | 'description'
  | 'compatibilityGroup'
  | 'equivalenceCode'
  | 'oemCodes'
  | 'alternativeCodes';

interface ParsedRow {
  rowNumber: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  unit: string | null;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  taxRate: number;
  active: boolean;
  description: string | null;
  compatibilityGroup: string | null;
  equivalenceCode: string | null;
  oemCodes: string[];
  alternativeCodes: string[];
  errors: string[];
  warnings: string[];
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: string[];
  errors: string[];
  previewRows: Array<{
    rowNumber: number;
    name: string;
    sku: string | null;
    barcode: string | null;
    category: string | null;
    brand: string | null;
    unit: string | null;
    price: number;
    stock: number;
    status: 'VALID' | 'WARNING' | 'ERROR';
    errors: string[];
    warnings: string[];
  }>;
  createdCategoriesPreview: string[];
  createdBrandsPreview: string[];
  createdUnitsPreview: string[];
  rows: ParsedRow[];
}

const TEMPLATE_HEADERS = [
  'nombre',
  'sku',
  'codigo_barras',
  'categoria',
  'marca',
  'unidad',
  'costo',
  'precio',
  'stock_inicial',
  'stock_minimo',
  'itbis',
  'activo',
  'descripcion',
  'grupo_compatibilidad',
  'codigo_equivalencia',
  'codigos_oem',
  'codigos_alternos',
];

const HEADER_MAP = new Map<string, ImportColumn>([
  ['nombre', 'name'],
  ['sku', 'sku'],
  ['codigo_barras', 'barcode'],
  ['codigo de barras', 'barcode'],
  ['código de barras', 'barcode'],
  ['barcode', 'barcode'],
  ['categoria', 'category'],
  ['categoría', 'category'],
  ['marca', 'brand'],
  ['unidad', 'unit'],
  ['costo', 'cost'],
  ['precio', 'price'],
  ['stock_inicial', 'stock'],
  ['stock inicial', 'stock'],
  ['stock_minimo', 'minStock'],
  ['stock mínimo', 'minStock'],
  ['stock_minimo', 'minStock'],
  ['itbis', 'taxRate'],
  ['activo', 'active'],
  ['descripcion', 'description'],
  ['descripción', 'description'],
  ['grupo_compatibilidad', 'compatibilityGroup'],
  ['grupo compatibilidad', 'compatibilityGroup'],
  ['codigo_equivalencia', 'equivalenceCode'],
  ['codigo equivalencia', 'equivalenceCode'],
  ['codigos_oem', 'oemCodes'],
  ['codigos oem', 'oemCodes'],
  ['codigos_alternos', 'alternativeCodes'],
  ['codigos alternos', 'alternativeCodes'],
]);

@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: CompanyEntitlementsService,
  ) {}

  async template() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Comercia ERP';
    const sheet = workbook.addWorksheet('Productos');
    sheet.addRow(TEMPLATE_HEADERS);
    sheet.addRow([
      'Café molido 1 lb',
      'CAF-001',
      '746000000001',
      'Abarrotes',
      'Marca Demo',
      'Unidad',
      180,
      250,
      12,
      3,
      18,
      'si',
      'Producto de ejemplo',
    ]);
    sheet.addRow([]);
    sheet.addRow([
      'Instrucciones: nombre y precio son obligatorios. Use .xlsx, no .xls ni .csv.',
    ]);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };
    sheet.columns.forEach((column) => {
      column.width = 20;
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(
    user: AuthUser,
    file: UploadedExcelFile,
    options: ProductImportOptionsDto,
  ) {
    const preview = await this.buildPreview(user, file, options);
    await this.entitlements.assertLimit(
      user.companyId,
      'products',
      preview.validRows,
    );
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'PRODUCT_IMPORT_PREVIEWED',
      module: 'products',
      description: 'Product import previewed',
      metadata: {
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        invalidRows: preview.invalidRows,
      },
    });
    return this.publicPreview(preview);
  }

  async commit(
    user: AuthUser,
    file: UploadedExcelFile,
    options: ProductImportOptionsDto,
  ) {
    if (!user.branchId) {
      throw new BadRequestException('Se requiere una sucursal activa');
    }
    const branchId = user.branchId;
    const preview = await this.buildPreview(user, file, options);
    await this.entitlements.assertLimit(
      user.companyId,
      'products',
      preview.validRows,
    );
    if (preview.invalidRows > 0) {
      await this.auditFailure(user, preview);
      throw new BadRequestException(
        'No se puede importar mientras existan filas con errores',
      );
    }
    const createMissingRelations = options.createMissingRelations !== false;
    const result = await this.prisma.$transaction(async (tx) => {
      const categories = await this.resolveCategories(
        tx,
        user.companyId,
        preview.rows,
        createMissingRelations,
      );
      const brands = await this.resolveBrands(
        tx,
        user.companyId,
        preview.rows,
        createMissingRelations,
      );
      const units = await this.resolveUnits(
        tx,
        user.companyId,
        preview.rows,
        createMissingRelations,
      );
      const createdProducts: Array<{
        id: string;
        name: string;
        row: ParsedRow;
      }> = [];
      let inventoryMovementsCreated = 0;
      for (const row of preview.rows) {
        const product = await tx.product.create({
          data: {
            companyId: user.companyId,
            name: row.name,
            sku: row.sku,
            barcode: row.barcode,
            description: row.description,
            categoryId: row.category ? categories.get(key(row.category)) : null,
            brandId: row.brand ? brands.get(key(row.brand)) : null,
            unitId: row.unit ? units.get(key(row.unit)) : null,
            cost: row.cost,
            price: row.price,
            taxRate: row.taxRate,
            stock: row.stock,
            minStock: row.minStock,
            trackInventory: true,
            status: row.active ? CatalogStatus.ACTIVE : CatalogStatus.INACTIVE,
          },
          select: { id: true, name: true },
        });
        createdProducts.push({ ...product, row });
        await this.audit.createWithClient(tx, {
          companyId: user.companyId,
          branchId: user.branchId,
          userId: user.userId,
          action: 'PRODUCT_CREATED_FROM_IMPORT',
          module: 'products',
          entityType: 'Product',
          entityId: product.id,
          description: 'Product created from Excel import',
        });
        await tx.productBranchStock.upsert({
          where: {
            companyId_branchId_productId: {
              companyId: user.companyId,
              branchId,
              productId: product.id,
            },
          },
          update: { quantity: row.stock, minStock: row.minStock },
          create: {
            companyId: user.companyId,
            branchId,
            productId: product.id,
            quantity: row.stock,
            minStock: row.minStock,
          },
        });
        if (row.stock > 0) {
          await tx.inventoryMovement.create({
            data: {
              companyId: user.companyId,
              branchId,
              productId: product.id,
              type: InventoryMovementType.MANUAL_ENTRY,
              quantity: row.stock,
              unitCost: row.cost,
              previousStock: 0,
              newStock: row.stock,
              reason: 'Importación Excel',
              referenceType: 'product_import',
              referenceId: product.id,
              createdById: user.userId,
            },
          });
          inventoryMovementsCreated += 1;
          await this.audit.createWithClient(tx, {
            companyId: user.companyId,
            branchId: user.branchId,
            userId: user.userId,
            action: 'PRODUCT_IMPORT_INITIAL_STOCK_BY_BRANCH',
            module: 'inventory',
            entityType: 'Product',
            entityId: product.id,
            description: 'Initial stock imported from Excel',
            metadata: { branchId, quantity: row.stock },
          });
        }
      }
      const compatibilityCreated = await this.importCompatibility(
        tx,
        user,
        createdProducts,
      );
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'PRODUCT_IMPORT_COMPLETED',
        module: 'products',
        description: 'Product import completed',
        metadata: {
          productsCreated: createdProducts.length,
          inventoryMovementsCreated,
          compatibilityCreated,
        },
      });
      return {
        productsCreated: createdProducts.length,
        rowsSkipped: 0,
        inventoryMovementsCreated,
        compatibilityCreated,
        createdProducts: createdProducts.map((item) => ({
          id: item.id,
          name: item.name,
        })),
      };
    });
    return { ...result, errors: [], warnings: preview.warnings };
  }

  private async buildPreview(
    user: AuthUser,
    file: UploadedExcelFile,
    options: ProductImportOptionsDto,
  ): Promise<ImportPreview> {
    const workbook = new ExcelJS.Workbook();
    const workbookBuffer = Buffer.from(file.buffer) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(workbookBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no tiene hojas');
    const columns = this.columns(sheet);
    const missing = ['name', 'price'].filter(
      (column) => !columns.some(({ name }) => name === column),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        missing.map((column) => `Falta la columna ${label(column)}`).join(', '),
      );
    }
    const parsedRows = this.parseRows(sheet, columns);
    await this.validateDuplicates(user.companyId, parsedRows);
    const createMissingRelations = options.createMissingRelations !== false;
    const [categories, brands, units] = await Promise.all([
      this.existingCategories(user.companyId),
      this.existingBrands(user.companyId),
      this.existingUnits(user.companyId),
    ]);
    const createdCategoriesPreview = missingNames(
      parsedRows.map((row) => row.category),
      categories,
    );
    const createdBrandsPreview = missingNames(
      parsedRows.map((row) => row.brand),
      brands,
    );
    const createdUnitsPreview = missingNames(
      parsedRows.map((row) => row.unit),
      units,
    );
    if (!createMissingRelations) {
      for (const row of parsedRows) {
        if (row.category && !categories.has(key(row.category))) {
          row.errors.push(`La categoría ${row.category} no existe`);
        }
        if (row.brand && !brands.has(key(row.brand))) {
          row.errors.push(`La marca ${row.brand} no existe`);
        }
        if (row.unit && !units.has(key(row.unit))) {
          row.errors.push(`La unidad ${row.unit} no existe`);
        }
      }
    } else {
      for (const row of parsedRows) {
        if (row.category && !categories.has(key(row.category))) {
          row.warnings.push(`Se creará la categoría ${row.category}`);
        }
        if (row.brand && !brands.has(key(row.brand))) {
          row.warnings.push(`Se creará la marca ${row.brand}`);
        }
        if (row.unit && !units.has(key(row.unit))) {
          row.warnings.push(`Se creará la unidad ${row.unit}`);
        }
      }
    }
    const validRows = parsedRows.filter(
      (row) => row.errors.length === 0,
    ).length;
    const invalidRows = parsedRows.length - validRows;
    return {
      totalRows: parsedRows.length,
      validRows,
      invalidRows,
      warnings: unique(parsedRows.flatMap((row) => row.warnings)),
      errors: unique(parsedRows.flatMap((row) => row.errors)),
      previewRows: parsedRows.map((row) => ({
        rowNumber: row.rowNumber,
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        category: row.category,
        brand: row.brand,
        unit: row.unit,
        price: row.price,
        stock: row.stock,
        status:
          row.errors.length > 0
            ? 'ERROR'
            : row.warnings.length > 0
              ? 'WARNING'
              : 'VALID',
        errors: row.errors,
        warnings: row.warnings,
      })),
      createdCategoriesPreview,
      createdBrandsPreview,
      createdUnitsPreview,
      rows: parsedRows,
    };
  }

  private columns(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    const columns: Array<{ index: number; name: ImportColumn }> = [];
    headerRow.eachCell((cell, index) => {
      const header = normalizeHeader(cellValue(cell));
      const name = HEADER_MAP.get(header);
      if (name) columns.push({ index, name });
    });
    if (columns.length === 0) {
      throw new BadRequestException('El archivo no tiene columnas válidas');
    }
    return columns;
  }

  private parseRows(
    sheet: ExcelJS.Worksheet,
    columns: Array<{ index: number; name: ImportColumn }>,
  ) {
    const rows: ParsedRow[] = [];
    const skuCounts = new Map<string, number>();
    const barcodeCounts = new Map<string, number>();
    const alternativeCodeCounts = new Map<string, number>();
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (rowIsEmpty(row)) continue;
      const values = new Map<ImportColumn, string>();
      for (const column of columns) {
        values.set(column.name, cellValue(row.getCell(column.index)));
      }
      const parsed = parseProductRow(rowNumber, values);
      rows.push(parsed);
      if (parsed.sku) increment(skuCounts, key(parsed.sku));
      if (parsed.barcode) increment(barcodeCounts, key(parsed.barcode));
      for (const code of rowAlternativeCodes(parsed)) {
        increment(alternativeCodeCounts, key(code));
      }
    }
    for (const row of rows) {
      if (row.sku && (skuCounts.get(key(row.sku)) ?? 0) > 1) {
        row.errors.push(`SKU duplicado en archivo: ${row.sku}`);
      }
      if (row.barcode && (barcodeCounts.get(key(row.barcode)) ?? 0) > 1) {
        row.errors.push(
          `Código de barras duplicado en archivo: ${row.barcode}`,
        );
      }
      for (const code of rowAlternativeCodes(row)) {
        if ((alternativeCodeCounts.get(key(code)) ?? 0) > 1) {
          row.errors.push(`Codigo alterno duplicado en archivo: ${code}`);
        }
      }
    }
    return rows;
  }

  private async validateDuplicates(companyId: string, rows: ParsedRow[]) {
    const skus = uniqueValues(rows.map((row) => row.sku));
    const barcodes = uniqueValues(rows.map((row) => row.barcode));
    const alternativeCodes = unique(
      rows.flatMap((row) => rowAlternativeCodes(row).map(key)),
    );
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          skus.length ? { sku: { in: skus } } : undefined,
          barcodes.length ? { barcode: { in: barcodes } } : undefined,
        ].filter(Boolean) as Prisma.ProductWhereInput[],
      },
      select: { sku: true, barcode: true },
    });
    const existingSkus = new Set(
      products.flatMap((product) => (product.sku ? [key(product.sku)] : [])),
    );
    const existingBarcodes = new Set(
      products.flatMap((product) =>
        product.barcode ? [key(product.barcode)] : [],
      ),
    );
    const existingAlternativeCodes = new Set(
      (
        await this.prisma.productAlternativeCode.findMany({
          where: { companyId, code: { in: alternativeCodes } },
          select: { code: true },
        })
      ).map((code) => key(code.code)),
    );
    for (const row of rows) {
      if (row.sku && existingSkus.has(key(row.sku))) {
        row.errors.push(`El SKU ${row.sku} ya existe`);
      }
      if (row.barcode && existingBarcodes.has(key(row.barcode))) {
        row.errors.push(`El código de barras ${row.barcode} ya existe`);
      }
      for (const code of rowAlternativeCodes(row)) {
        if (existingAlternativeCodes.has(key(code))) {
          row.errors.push(`El codigo alterno ${code} ya existe`);
        }
      }
    }
  }

  private existingCategories(companyId: string) {
    return this.prisma.category
      .findMany({
        where: {
          companyId,
          deletedAt: null,
          status: CatalogStatus.ACTIVE,
          type: { in: [CategoryType.PRODUCT, CategoryType.BOTH] },
        },
        select: { id: true, name: true },
      })
      .then((items) => new Map(items.map((item) => [key(item.name), item.id])));
  }

  private existingBrands(companyId: string) {
    return this.prisma.brand
      .findMany({
        where: { companyId, deletedAt: null, status: CatalogStatus.ACTIVE },
        select: { id: true, name: true },
      })
      .then((items) => new Map(items.map((item) => [key(item.name), item.id])));
  }

  private existingUnits(companyId: string) {
    return this.prisma.unit
      .findMany({
        where: { companyId, status: CatalogStatus.ACTIVE },
        select: { id: true, name: true },
      })
      .then((items) => new Map(items.map((item) => [key(item.name), item.id])));
  }

  private async resolveCategories(
    tx: Prisma.TransactionClient,
    companyId: string,
    rows: ParsedRow[],
    createMissing: boolean,
  ) {
    const existing = await this.existingCategoriesWithClient(tx, companyId);
    for (const name of uniqueValues(rows.map((row) => row.category))) {
      if (!existing.has(key(name)) && createMissing) {
        const category = await tx.category.create({
          data: { companyId, name, type: CategoryType.PRODUCT },
          select: { id: true },
        });
        existing.set(key(name), category.id);
      }
    }
    return existing;
  }

  private async resolveBrands(
    tx: Prisma.TransactionClient,
    companyId: string,
    rows: ParsedRow[],
    createMissing: boolean,
  ) {
    const existing = await this.existingBrandsWithClient(tx, companyId);
    for (const name of uniqueValues(rows.map((row) => row.brand))) {
      if (!existing.has(key(name)) && createMissing) {
        const brand = await tx.brand.create({
          data: { companyId, name },
          select: { id: true },
        });
        existing.set(key(name), brand.id);
      }
    }
    return existing;
  }

  private async resolveUnits(
    tx: Prisma.TransactionClient,
    companyId: string,
    rows: ParsedRow[],
    createMissing: boolean,
  ) {
    const existing = await this.existingUnitsWithClient(tx, companyId);
    const usedCodes = await tx.unit
      .findMany({ where: { companyId }, select: { code: true } })
      .then((items) => new Set(items.map((item) => item.code.toUpperCase())));
    for (const name of uniqueValues(rows.map((row) => row.unit))) {
      if (!existing.has(key(name)) && createMissing) {
        const unit = await tx.unit.create({
          data: {
            companyId,
            name,
            code: unitCode(name, usedCodes),
            allowsDecimals: true,
          },
          select: { id: true },
        });
        existing.set(key(name), unit.id);
      }
    }
    return existing;
  }

  private existingCategoriesWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    return tx.category
      .findMany({
        where: {
          companyId,
          deletedAt: null,
          status: CatalogStatus.ACTIVE,
          type: { in: [CategoryType.PRODUCT, CategoryType.BOTH] },
        },
        select: { id: true, name: true },
      })
      .then((items) => new Map(items.map((item) => [key(item.name), item.id])));
  }

  private existingBrandsWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    return tx.brand
      .findMany({
        where: { companyId, deletedAt: null, status: CatalogStatus.ACTIVE },
        select: { id: true, name: true },
      })
      .then((items) => new Map(items.map((item) => [key(item.name), item.id])));
  }

  private existingUnitsWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    return tx.unit
      .findMany({
        where: { companyId, status: CatalogStatus.ACTIVE },
        select: { id: true, name: true },
      })
      .then((items) => new Map(items.map((item) => [key(item.name), item.id])));
  }

  private async importCompatibility(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    products: Array<{ id: string; name: string; row: ParsedRow }>,
  ) {
    let compatibilityCreated = 0;
    const groupIds = new Map<string, string>();
    for (const item of products) {
      const groupCode = item.row.compatibilityGroup
        ? normalizeCompatibilityCode(item.row.compatibilityGroup)
        : null;
      if (groupCode) {
        let groupId = groupIds.get(groupCode);
        if (!groupId) {
          const group = await tx.productCompatibilityGroup.upsert({
            where: {
              companyId_code: { companyId: user.companyId, code: groupCode },
            },
            create: {
              companyId: user.companyId,
              code: groupCode,
              name: item.row.compatibilityGroup!,
            },
            update: {},
            select: { id: true },
          });
          groupId = group.id;
          groupIds.set(groupCode, groupId);
        }
        await tx.productCompatibilityGroupItem.create({
          data: { companyId: user.companyId, groupId, productId: item.id },
        });
        compatibilityCreated += 1;
      }
      const codes: Array<{ code: string; type: ProductAlternativeCodeType }> =
        [];
      if (item.row.equivalenceCode) {
        codes.push({
          code: item.row.equivalenceCode,
          type: ProductAlternativeCodeType.REPLACEMENT,
        });
      }
      codes.push(
        ...item.row.oemCodes.map((code) => ({
          code,
          type: ProductAlternativeCodeType.OEM,
        })),
        ...item.row.alternativeCodes.map((code) => ({
          code,
          type: ProductAlternativeCodeType.OTHER,
        })),
      );
      for (const code of codes) {
        await tx.productAlternativeCode.create({
          data: {
            companyId: user.companyId,
            productId: item.id,
            code: normalizeCompatibilityCode(code.code),
            type: code.type,
          },
        });
        compatibilityCreated += 1;
      }
    }
    if (compatibilityCreated > 0) {
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'PRODUCT_COMPATIBILITY_IMPORTED',
        module: 'product_compatibility',
        description: 'Product compatibility data imported from Excel',
        metadata: { compatibilityCreated },
      });
    }
    return compatibilityCreated;
  }

  private publicPreview(preview: ImportPreview) {
    return {
      totalRows: preview.totalRows,
      validRows: preview.validRows,
      invalidRows: preview.invalidRows,
      warnings: preview.warnings,
      errors: preview.errors,
      previewRows: preview.previewRows,
      createdCategoriesPreview: preview.createdCategoriesPreview,
      createdBrandsPreview: preview.createdBrandsPreview,
      createdUnitsPreview: preview.createdUnitsPreview,
    };
  }

  private auditFailure(user: AuthUser, preview: ImportPreview) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'PRODUCT_IMPORT_FAILED',
      module: 'products',
      description: 'Product import failed',
      metadata: {
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        invalidRows: preview.invalidRows,
        errors: preview.errors.slice(0, 20),
      },
    });
  }
}

function parseProductRow(
  rowNumber: number,
  values: Map<ImportColumn, string>,
): ParsedRow {
  const errors: string[] = [];
  const name = text(values.get('name'));
  const price = numberValue(values.get('price'));
  const cost = numberValue(values.get('cost'), 0);
  const stock = numberValue(values.get('stock'), 0);
  const minStock = numberValue(values.get('minStock'), 0);
  const taxRate = taxValue(values.get('taxRate'));
  if (!name) errors.push('nombre requerido');
  if (price === null) errors.push(`La fila ${rowNumber} tiene precio inválido`);
  if (cost === null) errors.push(`La fila ${rowNumber} tiene costo inválido`);
  if (stock === null) {
    errors.push(`La fila ${rowNumber} tiene stock inicial inválido`);
  }
  if (minStock === null) {
    errors.push(`La fila ${rowNumber} tiene stock mínimo inválido`);
  }
  if (taxRate === null)
    errors.push(`La fila ${rowNumber} tiene ITBIS inválido`);
  return {
    rowNumber,
    name,
    sku: optional(values.get('sku')),
    barcode: optional(values.get('barcode')),
    category: optional(values.get('category')),
    brand: optional(values.get('brand')),
    unit: optional(values.get('unit')),
    cost: cost ?? 0,
    price: price ?? 0,
    stock: stock ?? 0,
    minStock: minStock ?? 0,
    taxRate: taxRate ?? 18,
    active: booleanValue(values.get('active')),
    description: optional(values.get('description')),
    compatibilityGroup: optional(values.get('compatibilityGroup')),
    equivalenceCode: optional(values.get('equivalenceCode')),
    oemCodes: listValue(values.get('oemCodes')),
    alternativeCodes: listValue(values.get('alternativeCodes')),
    errors,
    warnings: [],
  };
}

function cellValue(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('text' in value && value.text) return String(value.text);
    if ('result' in value && value.result != null) {
      return primitiveText(value.result);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
  }
  return primitiveText(value);
}

function primitiveText(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function rowIsEmpty(row: ExcelJS.Row) {
  let hasValue = false;
  row.eachCell((cell) => {
    if (cellValue(cell)) hasValue = true;
  });
  return !hasValue;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function text(value: string | undefined) {
  return (value ?? '').trim();
}

function optional(value: string | undefined) {
  const next = text(value);
  return next ? next : null;
}

function listValue(value: string | undefined) {
  return unique(
    text(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function numberValue(value: string | undefined, fallback?: number) {
  const raw = text(value).replace(',', '.');
  if (!raw && fallback !== undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function taxValue(value: string | undefined) {
  const raw = text(value).toLowerCase();
  if (!raw) return 18;
  if (['si', 'sí', 'true', 'activo', 'yes'].includes(raw)) return 18;
  if (['no', 'false'].includes(raw)) return 0;
  const parsed = Number(raw.replace('%', '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

function booleanValue(value: string | undefined) {
  const raw = text(value).toLowerCase();
  if (!raw) return true;
  return !['no', 'false', '0', 'inactivo'].includes(raw);
}

function key(value: string) {
  return value.trim().toLowerCase();
}

function increment(map: Map<string, number>, value: string) {
  map.set(value, (map.get(value) ?? 0) + 1);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function uniqueValues(values: Array<string | null>) {
  return unique(values.filter((value): value is string => Boolean(value)));
}

function rowAlternativeCodes(row: ParsedRow) {
  return [row.equivalenceCode, ...row.oemCodes, ...row.alternativeCodes].filter(
    (value): value is string => Boolean(value),
  );
}

function missingNames(
  values: Array<string | null>,
  existing: Map<string, string>,
) {
  return uniqueValues(values).filter((value) => !existing.has(key(value)));
}

function label(column: string) {
  return column === 'name' ? 'nombre' : 'precio';
}

function unitCode(name: string, usedCodes: Set<string>) {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase() || 'UNI';
  let code = base;
  let index = 1;
  while (usedCodes.has(code)) {
    code = `${base.slice(0, 8)}${index}`.slice(0, 12);
    index += 1;
  }
  usedCodes.add(code);
  return code;
}

function normalizeCompatibilityCode(value: string) {
  return value.trim().toUpperCase();
}
