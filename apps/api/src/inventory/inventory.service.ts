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
import { CreateInventoryTransferDto } from './dto/create-inventory-transfer.dto';
import { InventoryMovementsQueryDto } from './dto/inventory-movements-query.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { ManualEntryDto } from './dto/manual-entry.dto';
import { BranchInventoryService } from './branch-inventory.service';

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
    private readonly branchInventory: BranchInventoryService,
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

    const hydrated = await this.withActiveBranchStock(user, items);
    return { items: hydrated, total, page, limit };
  }

  async findLowStock(user: AuthUser, query: InventoryQueryDto) {
    const { page, limit, where } = this.buildProductQuery(user, query);
    const items = await this.prisma.product.findMany({
      where: { ...where, trackInventory: true, status: CatalogStatus.ACTIVE },
      include: productInventoryInclude,
      orderBy: [{ name: 'asc' }],
    });

    const hydrated = await this.withActiveBranchStock(user, items);
    const filtered = hydrated.filter(
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
    const where = {
      companyId: user.companyId,
      productId,
      branchId: user.branchId ?? undefined,
    };
    const stock = user.branchId
      ? await this.branchInventory.ensureStock(
          this.prisma,
          user.companyId,
          user.branchId,
          productId,
          { quantity: product.stock, minStock: product.minStock },
        )
      : null;

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
        stock: stock?.quantity ?? product.stock,
        minStock: stock?.minStock ?? product.minStock,
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

  async stockByBranch(user: AuthUser, productId: string) {
    const product = await this.findTrackedProduct(user, productId);
    const branches = await this.prisma.branch.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, isMain: true, status: true },
    });
    const stocks = await this.prisma.productBranchStock.findMany({
      where: { companyId: user.companyId, productId },
    });
    const byBranch = new Map(stocks.map((stock) => [stock.branchId, stock]));
    return {
      product: { id: product.id, name: product.name },
      items: branches.map((branch) => {
        const stock = byBranch.get(branch.id);
        return {
          branch,
          quantity: stock?.quantity ?? new Prisma.Decimal(0),
          minStock: stock?.minStock ?? product.minStock,
          status: this.stockStatus(
            stock?.quantity ?? new Prisma.Decimal(0),
            stock?.minStock ?? product.minStock,
          ),
        };
      }),
    };
  }

  async createTransfer(user: AuthUser, dto: CreateInventoryTransferDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException(
        'La sucursal origen y destino deben ser diferentes',
      );
    }
    const quantity = new Prisma.Decimal(dto.quantity);
    const note = dto.note?.trim() || 'Transferencia entre sucursales';

    const transferId = await this.prisma.$transaction(async (tx) => {
      const [fromBranch, toBranch, product] = await Promise.all([
        tx.branch.findFirst({
          where: {
            id: dto.fromBranchId,
            companyId: user.companyId,
            deletedAt: null,
          },
          select: { id: true, name: true },
        }),
        tx.branch.findFirst({
          where: {
            id: dto.toBranchId,
            companyId: user.companyId,
            deletedAt: null,
          },
          select: { id: true, name: true },
        }),
        tx.product.findFirst({
          where: {
            id: dto.productId,
            companyId: user.companyId,
            deletedAt: null,
            trackInventory: true,
          },
          select: {
            id: true,
            name: true,
            cost: true,
            stock: true,
            minStock: true,
          },
        }),
      ]);
      if (!fromBranch || !toBranch) {
        throw new BadRequestException(
          'Una de las sucursales no esta disponible',
        );
      }
      if (!product) throw new NotFoundException('Product was not found');

      const fromStock = await this.branchInventory.ensureStock(
        tx,
        user.companyId,
        dto.fromBranchId,
        product.id,
        { minStock: product.minStock },
      );
      const toStock = await this.branchInventory.ensureStock(
        tx,
        user.companyId,
        dto.toBranchId,
        product.id,
        { minStock: product.minStock },
      );
      if (new Prisma.Decimal(fromStock.quantity).lessThan(quantity)) {
        throw new BadRequestException(
          `Stock insuficiente en ${fromBranch.name}. Disponible: ${fromStock.quantity.toString()}. Solicitado: ${quantity.toString()}`,
        );
      }

      const nextFrom = new Prisma.Decimal(fromStock.quantity).sub(quantity);
      const nextTo = new Prisma.Decimal(toStock.quantity).add(quantity);
      await tx.productBranchStock.update({
        where: { id: fromStock.id },
        data: { quantity: nextFrom },
      });
      await tx.productBranchStock.update({
        where: { id: toStock.id },
        data: { quantity: nextTo },
      });
      const transfer = await tx.inventoryTransfer.create({
        data: {
          companyId: user.companyId,
          fromBranchId: dto.fromBranchId,
          toBranchId: dto.toBranchId,
          note,
          createdById: user.userId,
          items: {
            create: {
              companyId: user.companyId,
              productId: product.id,
              quantity,
            },
          },
        },
        select: { id: true },
      });
      await tx.inventoryMovement.createMany({
        data: [
          {
            companyId: user.companyId,
            branchId: dto.fromBranchId,
            productId: product.id,
            type: InventoryMovementType.ADJUSTMENT_OUT,
            quantity,
            unitCost: product.cost,
            previousStock: fromStock.quantity,
            newStock: nextFrom,
            reason: note,
            referenceType: 'InventoryTransfer',
            referenceId: transfer.id,
            createdById: user.userId,
          },
          {
            companyId: user.companyId,
            branchId: dto.toBranchId,
            productId: product.id,
            type: InventoryMovementType.ADJUSTMENT_IN,
            quantity,
            unitCost: product.cost,
            previousStock: toStock.quantity,
            newStock: nextTo,
            reason: note,
            referenceType: 'InventoryTransfer',
            referenceId: transfer.id,
            createdById: user.userId,
          },
        ],
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: dto.fromBranchId,
        userId: user.userId,
        action: 'INVENTORY_TRANSFER_CREATED',
        module: 'inventory',
        entityType: 'InventoryTransfer',
        entityId: transfer.id,
        description: `Transferencia de inventario para ${product.name}`,
        metadata: {
          productId: product.id,
          fromBranchId: dto.fromBranchId,
          toBranchId: dto.toBranchId,
          quantity: quantity.toString(),
        },
      });
      return transfer.id;
    });

    return this.findTransfer(user, transferId);
  }

  async findTransfers(user: AuthUser) {
    return this.prisma.inventoryTransfer.findMany({
      where: { companyId: user.companyId },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findTransfer(user: AuthUser, id: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    return transfer;
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

      const stock = await this.branchInventory.ensureStock(
        tx,
        user.companyId,
        branchId,
        product.id,
        { minStock: product.minStock },
      );
      const previousStock = new Prisma.Decimal(stock.quantity);
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

      await tx.productBranchStock.update({
        where: { id: stock.id },
        data: { quantity: newStock },
      });
      const updatedProduct = { ...product, stock: newStock };

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

  private async withActiveBranchStock<
    T extends { id: string; stock: Prisma.Decimal; minStock: Prisma.Decimal },
  >(user: AuthUser, products: T[]) {
    const stockMap = await this.branchInventory.stockMap(
      this.prisma,
      user.companyId,
      user.branchId,
      products.map(({ id }) => id),
    );
    return products.map((product) => {
      const stock = stockMap.get(product.id);
      return {
        ...product,
        stock: stock?.quantity ?? new Prisma.Decimal(0),
        minStock: stock?.minStock ?? product.minStock,
        activeBranchId: user.branchId,
        stockStatus: this.stockStatus(
          stock?.quantity ?? new Prisma.Decimal(0),
          stock?.minStock ?? product.minStock,
        ),
      };
    });
  }

  private stockStatus(
    quantity: Prisma.Decimal | number | string,
    minStock: Prisma.Decimal | number | string,
  ) {
    const stock = new Prisma.Decimal(quantity);
    if (stock.lessThanOrEqualTo(0)) return 'OUT_OF_STOCK';
    if (stock.lessThanOrEqualTo(minStock)) return 'LOW_STOCK';
    return 'AVAILABLE';
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
