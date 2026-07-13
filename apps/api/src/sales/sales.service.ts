import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BranchStatus,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  SaleItemType,
  SaleStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service';
import { CashRequiredForSaleError, CashService } from '../cash/cash.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BranchInventoryService } from '../inventory/branch-inventory.service';
import { PosService, type CartCalculation } from '../pos/pos.service';
import { PosItemType } from '../pos/pos.types';
import { PrismaService } from '../prisma/prisma.service';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesQueryDto } from './dto/sales-query.dto';

const saleSummaryInclude = {
  customer: { select: { id: true, name: true, documentNumber: true } },
  branch: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SaleInclude;

const saleDetailInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
    },
  },
  branch: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  cancelledBy: { select: { id: true, name: true, email: true } },
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.SaleInclude;

class InsufficientStockError extends Error {
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly quantity: number,
  ) {
    super('Insufficient stock');
  }
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pos: PosService,
    private readonly cash: CashService,
    private readonly audit: AuditService,
    private readonly branchInventory: BranchInventoryService,
  ) {}

  async findAll(user: AuthUser, query: SalesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.SaleWhereInput = {
      companyId: user.companyId,
      branchId: user.branchId ?? undefined,
      status: query.status,
      customerId: query.customerId,
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
            { saleNumber: { contains: search, mode: 'insensitive' } },
            {
              customer: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
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
      this.prisma.sale.findMany({
        where,
        include: saleSummaryInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(user: AuthUser, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        companyId: user.companyId,
        branchId: user.branchId ?? undefined,
      },
      include: saleDetailInclude,
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  async create(user: AuthUser, dto: CreateSaleDto) {
    const branchId = user.branchId;
    if (!branchId) {
      throw new BadRequestException(
        'Se requiere una sucursal activa para crear la venta',
      );
    }

    try {
      const saleId = await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findFirst({
          where: {
            id: branchId,
            companyId: user.companyId,
            deletedAt: null,
            status: BranchStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (!branch) {
          throw new BadRequestException('La sucursal no está disponible');
        }

        const cashSession = await this.cash.resolveSessionForSale(tx, user);
        const calculation = await this.pos.calculateCart(
          tx,
          user.companyId,
          branchId,
          {
            customerId: dto.customerId,
            items: dto.items,
          },
        );
        if (!calculation.valid) {
          const stockError = calculation.errors.find(
            ({ code }) => code === 'INSUFFICIENT_STOCK',
          );
          if (stockError?.itemId) {
            const inventory = calculation.inventory.find(
              ({ productId }) => productId === stockError.itemId,
            );
            throw new InsufficientStockError(
              stockError.itemId,
              inventory?.name ?? 'Producto',
              inventory?.quantity ?? 0,
            );
          }
          throw new BadRequestException({
            message: 'El carrito no es válido',
            errors: calculation.errors,
          });
        }

        const payment = this.paymentTotals(dto, calculation);
        const sale = await tx.sale.create({
          data: {
            companyId: user.companyId,
            branchId,
            customerId: calculation.customer?.id,
            cashSessionId: cashSession?.id,
            saleNumber: this.saleNumber(),
            status: SaleStatus.COMPLETED,
            subtotal: calculation.subtotal,
            taxTotal: calculation.taxTotal,
            discountTotal: calculation.discountTotal,
            total: calculation.total,
            paidTotal: payment.paidTotal,
            balanceDue: payment.balanceDue,
            notes: this.optional(dto.notes),
            createdById: user.userId,
            items: {
              create: calculation.items.map((item) => ({
                companyId: user.companyId,
                itemType:
                  item.itemType === PosItemType.PRODUCT
                    ? SaleItemType.PRODUCT
                    : SaleItemType.SERVICE,
                productId: item.productId,
                serviceId: item.serviceId,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
                discountAmount: item.discountAmount,
                subtotal: item.lineSubtotal,
                taxTotal: item.taxAmount,
                total: item.lineTotal,
                affectsInventory: item.affectsInventory,
              })),
            },
            payments: {
              create: dto.payments.map((item) => ({
                companyId: user.companyId,
                cashSessionId: cashSession?.id,
                method: item.method,
                amount: item.amount,
                reference: this.optional(item.reference),
                notes: this.optional(item.notes),
                createdById: user.userId,
              })),
            },
          },
          select: { id: true },
        });

        await this.deductInventory(tx, user, sale.id, calculation);
        await this.cash.registerSaleCashPayment(
          tx,
          user,
          cashSession?.id ?? null,
          sale.id,
          dto.payments,
        );
        await this.audit.createWithClient(tx, {
          companyId: user.companyId,
          branchId,
          userId: user.userId,
          action: 'SALE_CREATED',
          module: 'sales',
          entityType: 'Sale',
          entityId: sale.id,
          description: 'Venta interna creada',
          metadata: {
            customerId: calculation.customer?.id ?? null,
            total: calculation.total,
            paidTotal: payment.paidTotal,
            balanceDue: payment.balanceDue,
            items: calculation.items.map((item) => ({
              itemType: item.itemType,
              itemId: item.itemId,
              quantity: item.quantity,
            })),
          },
        });
        return sale.id;
      });
      return this.findOne(user, saleId);
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        await this.audit.create({
          companyId: user.companyId,
          branchId,
          userId: user.userId,
          action: 'SALE_BLOCKED_INSUFFICIENT_STOCK',
          module: 'sales',
          entityType: 'Product',
          entityId: error.productId,
          description: `Venta bloqueada por stock insuficiente para ${error.productName}`,
          metadata: { quantity: error.quantity },
        });
        throw new BadRequestException(
          `Stock insuficiente para ${error.productName}`,
        );
      }
      if (error instanceof CashRequiredForSaleError) {
        await this.audit.create({
          companyId: user.companyId,
          branchId,
          userId: user.userId,
          action: 'CASH_REQUIRED_FOR_SALE_BLOCKED',
          module: 'cash',
          entityType: 'User',
          entityId: user.userId,
          description: 'Venta bloqueada porque no hay una caja abierta',
          metadata: { branchId },
        });
        throw new BadRequestException(
          'Debes abrir una caja antes de registrar la venta',
        );
      }
      throw error;
    }
  }

  async cancel(user: AuthUser, id: string, dto: CancelSaleDto) {
    const reason = dto.reason.trim();
    const saleId = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, companyId: user.companyId },
        include: { items: true },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException(
          'Solo se pueden anular ventas completadas',
        );
      }

      const updated = await tx.sale.updateMany({
        where: {
          id: sale.id,
          companyId: user.companyId,
          status: SaleStatus.COMPLETED,
        },
        data: {
          status: SaleStatus.CANCELLED,
          cancelledById: user.userId,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('La venta ya no puede anularse');
      }

      const quantities = new Map<string, Prisma.Decimal>();
      for (const item of sale.items) {
        if (!item.productId || !item.affectsInventory) continue;
        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? new Prisma.Decimal(0)).add(
            item.quantity,
          ),
        );
      }

      for (const [productId, quantity] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const product = await tx.product.findFirst({
          where: { id: productId, companyId: user.companyId },
        });
        if (!product) {
          throw new BadRequestException(
            'No se pudo restaurar un producto de la venta',
          );
        }
        const stock = await this.branchInventory.ensureStock(
          tx,
          user.companyId,
          sale.branchId,
          product.id,
          { quantity: product.stock, minStock: product.minStock },
        );
        const previousStock = new Prisma.Decimal(stock.quantity);
        const newStock = previousStock.add(quantity);
        await tx.productBranchStock.update({
          where: { id: stock.id },
          data: { quantity: newStock },
        });
        const movement = await tx.inventoryMovement.create({
          data: {
            companyId: user.companyId,
            branchId: sale.branchId,
            productId: product.id,
            type: InventoryMovementType.VOID_SALE_IN,
            quantity,
            unitCost: product.cost,
            previousStock,
            newStock,
            reason,
            referenceType: 'Sale',
            referenceId: sale.id,
            createdById: user.userId,
          },
        });
        await this.audit.createWithClient(tx, {
          companyId: user.companyId,
          branchId: sale.branchId,
          userId: user.userId,
          action: 'SALE_STOCK_RESTORED',
          module: 'sales',
          entityType: 'InventoryMovement',
          entityId: movement.id,
          description: `Stock restaurado por anulación de ${sale.saleNumber}`,
          metadata: {
            saleId: sale.id,
            productId,
            quantity: quantity.toString(),
            previousStock: previousStock.toString(),
            newStock: newStock.toString(),
          },
        });
      }

      await this.cash.reverseSaleCashPayment(tx, user, sale, reason);
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: sale.branchId,
        userId: user.userId,
        action: 'SALE_CANCELLED',
        module: 'sales',
        entityType: 'Sale',
        entityId: sale.id,
        description: `Venta ${sale.saleNumber} anulada`,
        metadata: { reason, customerId: sale.customerId },
      });
      return sale.id;
    });
    return this.findOne(user, saleId);
  }

  private paymentTotals(dto: CreateSaleDto, calculation: CartCalculation) {
    let tendered = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    for (const payment of dto.payments) {
      const amount = new Prisma.Decimal(payment.amount);
      tendered = tendered.add(amount);
      if (payment.method !== PaymentMethod.CREDIT) paid = paid.add(amount);
    }
    const total = new Prisma.Decimal(calculation.total);
    if (tendered.lessThan(total)) {
      throw new BadRequestException(
        'Los pagos, incluyendo crédito, deben cubrir el total de la venta',
      );
    }
    return {
      paidTotal: this.money(paid),
      balanceDue: this.money(Prisma.Decimal.max(total.sub(paid), 0)),
    };
  }

  private async deductInventory(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    saleId: string,
    calculation: CartCalculation,
  ) {
    for (const request of calculation.inventory
      .filter(({ trackInventory }) => trackInventory)
      .sort((a, b) => a.productId.localeCompare(b.productId))) {
      const quantity = new Prisma.Decimal(request.quantity);
      const product = await tx.product.findFirst({
        where: { id: request.productId, companyId: user.companyId },
      });
      if (!product) {
        throw new InsufficientStockError(
          request.productId,
          request.name,
          request.quantity,
        );
      }
      const stock = await this.branchInventory.ensureStock(
        tx,
        user.companyId,
        user.branchId!,
        product.id,
        { quantity: product.stock, minStock: product.minStock },
      );
      const updated = calculation.allowNegativeStock
        ? await tx.productBranchStock.updateMany({
            where: { id: stock.id, companyId: user.companyId },
            data: { quantity: { decrement: quantity } },
          })
        : await tx.productBranchStock.updateMany({
            where: {
              id: stock.id,
              companyId: user.companyId,
              quantity: { gte: quantity },
            },
            data: { quantity: { decrement: quantity } },
          });
      if (updated.count !== 1) {
        throw new InsufficientStockError(
          product.id,
          product.name,
          request.quantity,
        );
      }
      const updatedStock = await tx.productBranchStock.findUniqueOrThrow({
        where: { id: stock.id },
      });
      const newStock = new Prisma.Decimal(updatedStock.quantity);
      const previousStock = newStock.add(quantity);
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: user.companyId,
          branchId: user.branchId!,
          productId: product.id,
          type: InventoryMovementType.SALE_OUT,
          quantity,
          unitCost: product.cost,
          previousStock,
          newStock,
          reason: 'Salida por venta',
          referenceType: 'Sale',
          referenceId: saleId,
          createdById: user.userId,
        },
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'SALE_STOCK_DEDUCTED_BY_BRANCH',
        module: 'sales',
        entityType: 'InventoryMovement',
        entityId: movement.id,
        description: `Stock descontado por venta para ${product.name}`,
        metadata: {
          saleId,
          productId: product.id,
          quantity: quantity.toString(),
          previousStock: previousStock.toString(),
          newStock: newStock.toString(),
        },
      });
    }
  }

  private saleNumber() {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `V-${day}-${randomUUID().slice(0, 8).toUpperCase()}`;
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

  private money(value: Prisma.Decimal | number | string) {
    return Number(new Prisma.Decimal(value).toFixed(2));
  }
}
