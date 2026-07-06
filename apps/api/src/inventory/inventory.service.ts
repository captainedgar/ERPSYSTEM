import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogStatus, InventoryMovementType, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryMovementsQueryDto } from './dto/inventory-movements-query.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { ManualEntryDto } from './dto/manual-entry.dto';

const productInventoryInclude = {
  category: { select: { id: true, name: true, type: true } },
  brand: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(user: AuthUser, query: InventoryQueryDto) {
    if (query.lowStock === 'true') {
      return this.findLowStock(user, query);
    }

    const { page, limit, where } = this.buildProductQuery(user, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInventoryInclude,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findLowStock(user: AuthUser, query: InventoryQueryDto) {
    const { page, limit, where } = this.buildProductQuery(user, query);
    const items = await this.prisma.product.findMany({
      where: { ...where, trackInventory: true, status: CatalogStatus.ACTIVE },
      include: productInventoryInclude,
      orderBy: [{ name: 'asc' }],
    });

    const filtered = items.filter(
      (product) => Number(product.stock) <= Number(product.minStock),
    );

    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  async findProductMovements(
    user: AuthUser,
    productId: string,
    query: InventoryMovementsQueryDto,
  ) {
    const product = await this.findTrackedProduct(user, productId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { companyId: user.companyId, productId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return {
      product: {
        id: product.id,
        name: product.name,
        stock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
      },
      items,
      total,
      page,
      limit,
    };
  }

  async manualEntry(user: AuthUser, productId: string, dto: ManualEntryDto) {
    const { product, movement } = await this.createMovement({
      user,
      productId,
      type: InventoryMovementType.MANUAL_ENTRY,
      quantity: dto.quantity,
      reason: dto.reason,
      unitCost: dto.unitCost,
      operation: 'increase',
    });

    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'INVENTORY_MANUAL_ENTRY',
      module: 'inventory',
      entityType: 'InventoryMovement',
      entityId: movement.id,
      description: `Entrada manual registrada para ${product.name}`,
      metadata: this.movementMetadata(movement),
    });

    return { product, movement };
  }

  async adjust(user: AuthUser, productId: string, dto: AdjustInventoryDto) {
    const { product, movement } = await this.createMovement({
      user,
      productId,
      type: dto.type,
      quantity: dto.quantity,
      reason: dto.reason,
      operation:
        dto.type === InventoryMovementType.ADJUSTMENT_IN
          ? 'increase'
          : 'decrease',
    });

    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action:
        dto.type === InventoryMovementType.ADJUSTMENT_IN
          ? 'INVENTORY_ADJUSTMENT_IN'
          : 'INVENTORY_ADJUSTMENT_OUT',
      module: 'inventory',
      entityType: 'InventoryMovement',
      entityId: movement.id,
      description: `Ajuste de inventario registrado para ${product.name}`,
      metadata: this.movementMetadata(movement),
    });

    return { product, movement };
  }

  private buildProductQuery(user: AuthUser, query: InventoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const trimmedSearch = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { name: { contains: trimmedSearch, mode: 'insensitive' } },
              { sku: { contains: trimmedSearch, mode: 'insensitive' } },
              { barcode: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return { page, limit, where };
  }

  private async findTrackedProduct(user: AuthUser, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        companyId: user.companyId,
        deletedAt: null,
      },
      include: productInventoryInclude,
    });

    if (!product) {
      throw new NotFoundException('Product was not found');
    }

    if (!product.trackInventory) {
      throw new BadRequestException(
        'This product does not track inventory movements',
      );
    }

    return product;
  }

  private async createMovement({
    user,
    productId,
    type,
    quantity,
    reason,
    unitCost,
    operation,
  }: {
    user: AuthUser;
    productId: string;
    type: InventoryMovementType;
    quantity: number;
    reason: string;
    unitCost?: number;
    operation: 'increase' | 'decrease';
  }) {
    const branchId = user.branchId;
    if (!branchId) {
      throw new BadRequestException(
        'An active branch is required to register inventory movements',
      );
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      throw new BadRequestException('Reason is required');
    }

    const quantityDecimal = new Prisma.Decimal(quantity);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: productId,
          companyId: user.companyId,
          deletedAt: null,
        },
        include: productInventoryInclude,
      });

      if (!product) {
        throw new NotFoundException('Product was not found');
      }

      if (!product.trackInventory) {
        throw new BadRequestException(
          'This product does not track inventory movements',
        );
      }

      const previousStock = new Prisma.Decimal(product.stock);
      const newStock =
        operation === 'increase'
          ? previousStock.add(quantityDecimal)
          : previousStock.sub(quantityDecimal);

      if (operation === 'decrease') {
        const settings = await tx.businessSettings.findUniqueOrThrow({
          where: { companyId: user.companyId },
          select: { allowNegativeStock: true },
        });

        if (!settings.allowNegativeStock && newStock.isNegative()) {
          await this.audit.create({
            companyId: user.companyId,
            branchId,
            userId: user.userId,
            action: 'INVENTORY_NEGATIVE_STOCK_BLOCKED',
            module: 'inventory',
            entityType: 'Product',
            entityId: product.id,
            description: `Ajuste bloqueado para ${product.name} por stock negativo`,
            metadata: {
              attemptedType: type,
              quantity: quantityDecimal.toString(),
              previousStock: previousStock.toString(),
              attemptedNewStock: newStock.toString(),
              reason: normalizedReason,
            },
          });
          throw new BadRequestException(
            'Negative stock is not allowed by business settings',
          );
        }
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
        include: productInventoryInclude,
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: user.companyId,
          branchId,
          productId: product.id,
          type,
          quantity: quantityDecimal,
          unitCost:
            unitCost === undefined ? undefined : new Prisma.Decimal(unitCost),
          previousStock,
          newStock,
          reason: normalizedReason,
          createdById: user.userId,
        },
      });

      return { product: updatedProduct, movement };
    });
  }

  private movementMetadata(movement: {
    productId: string;
    type: InventoryMovementType;
    quantity: Prisma.Decimal | number | string;
    previousStock: Prisma.Decimal | number | string;
    newStock: Prisma.Decimal | number | string;
    reason: string;
  }) {
    return {
      productId: movement.productId,
      type: movement.type,
      quantity: this.decimalToString(movement.quantity),
      previousStock: this.decimalToString(movement.previousStock),
      newStock: this.decimalToString(movement.newStock),
      reason: movement.reason,
    };
  }

  private decimalToString(value: Prisma.Decimal | number | string) {
    return value instanceof Prisma.Decimal ? value.toString() : `${value}`;
  }
}
