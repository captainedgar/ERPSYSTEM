import { Injectable } from '@nestjs/common';
import { CatalogStatus, Prisma } from '@prisma/client';

import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { PosSearchQueryDto } from './dto/pos-search-query.dto';
import {
  ValidateCartDto,
  type ValidateCartItemDto,
} from './dto/validate-cart.dto';
import { PosItemType, PosSearchType } from './pos.types';

const productInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProductInclude;

const serviceInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ServiceInclude;

type PosProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type PosServiceItem = Prisma.ServiceGetPayload<{
  include: typeof serviceInclude;
}>;

export interface CartError {
  code: string;
  message: string;
  itemIndex?: number;
  itemId?: string;
}

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async searchItems(user: AuthUser, query: PosSearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const type = query.type ?? PosSearchType.ALL;
    const search = query.search?.trim();
    const requested = page * limit;

    const productWhere: Prisma.ProductWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      status: CatalogStatus.ACTIVE,
      categoryId: query.categoryId,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
            {
              category: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
    const serviceWhere: Prisma.ServiceWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      status: CatalogStatus.ACTIVE,
      categoryId: query.categoryId,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            {
              category: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };

    const includeProducts = type !== PosSearchType.SERVICE;
    const includeServices = type !== PosSearchType.PRODUCT;
    const [products, productTotal, services, serviceTotal] = await Promise.all([
      includeProducts
        ? this.prisma.product.findMany({
            where: productWhere,
            include: productInclude,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            take: requested,
          })
        : Promise.resolve([]),
      includeProducts
        ? this.prisma.product.count({ where: productWhere })
        : Promise.resolve(0),
      includeServices
        ? this.prisma.service.findMany({
            where: serviceWhere,
            include: serviceInclude,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            take: requested,
          })
        : Promise.resolve([]),
      includeServices
        ? this.prisma.service.count({ where: serviceWhere })
        : Promise.resolve(0),
    ]);

    const combined = [
      ...products.map((product) => this.productResult(product)),
      ...services.map((service) => this.serviceResult(service)),
    ].sort(
      (left, right) =>
        left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }) ||
        left.type.localeCompare(right.type) ||
        left.id.localeCompare(right.id),
    );

    return {
      items: combined.slice((page - 1) * limit, page * limit),
      total: productTotal + serviceTotal,
      page,
      limit,
    };
  }

  async validateCart(user: AuthUser, dto: ValidateCartDto) {
    const productIds = this.uniqueIds(dto.items, PosItemType.PRODUCT);
    const serviceIds = this.uniqueIds(dto.items, PosItemType.SERVICE);
    const [products, services, settings, customer] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          companyId: user.companyId,
          deletedAt: null,
          status: CatalogStatus.ACTIVE,
        },
        include: productInclude,
      }),
      this.prisma.service.findMany({
        where: {
          id: { in: serviceIds },
          companyId: user.companyId,
          deletedAt: null,
          status: CatalogStatus.ACTIVE,
        },
        include: serviceInclude,
      }),
      this.prisma.businessSettings.findUniqueOrThrow({
        where: { companyId: user.companyId },
        select: { allowNegativeStock: true },
      }),
      dto.customerId
        ? this.prisma.customer.findFirst({
            where: {
              id: dto.customerId,
              companyId: user.companyId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: {
              id: true,
              name: true,
              documentType: true,
              documentNumber: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const productMap = new Map(products.map((item) => [item.id, item]));
    const serviceMap = new Map(services.map((item) => [item.id, item]));
    const errors: CartError[] = [];
    const warnings: CartError[] = [];
    const calculatedItems: Array<Record<string, unknown>> = [];
    const requestedProductQuantities = new Map<string, Prisma.Decimal>();
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);

    if (dto.customerId && !customer) {
      errors.push({
        code: 'CUSTOMER_NOT_AVAILABLE',
        message:
          'El cliente no existe, está inactivo o pertenece a otra empresa.',
      });
    }

    dto.items.forEach((input, itemIndex) => {
      const item =
        input.itemType === PosItemType.PRODUCT
          ? productMap.get(input.itemId)
          : serviceMap.get(input.itemId);
      const quantity = new Prisma.Decimal(input.quantity);
      const requestedDiscount = new Prisma.Decimal(input.discountAmount ?? 0);

      if (!item) {
        errors.push({
          code: 'ITEM_NOT_AVAILABLE',
          message:
            'El artículo no existe, está inactivo o pertenece a otra empresa.',
          itemIndex,
          itemId: input.itemId,
        });
        return;
      }
      if (!quantity.greaterThan(0)) {
        errors.push({
          code: 'INVALID_QUANTITY',
          message: 'La cantidad debe ser mayor que cero.',
          itemIndex,
          itemId: input.itemId,
        });
        return;
      }
      if (requestedDiscount.isNegative()) {
        errors.push({
          code: 'INVALID_DISCOUNT',
          message: 'El descuento no puede ser negativo.',
          itemIndex,
          itemId: input.itemId,
        });
      }

      const lineSubtotal = new Prisma.Decimal(item.price)
        .mul(quantity)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      if (requestedDiscount.greaterThan(lineSubtotal)) {
        errors.push({
          code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
          message: 'El descuento no puede exceder el subtotal del artículo.',
          itemIndex,
          itemId: input.itemId,
        });
      }
      if (!item.allowDiscount && requestedDiscount.isPositive()) {
        errors.push({
          code: 'DISCOUNT_NOT_ALLOWED',
          message: 'Este artículo no permite descuentos.',
          itemIndex,
          itemId: input.itemId,
        });
      }

      const appliedDiscount =
        requestedDiscount.isNegative() ||
        (!item.allowDiscount && requestedDiscount.isPositive())
          ? new Prisma.Decimal(0)
          : Prisma.Decimal.min(requestedDiscount, lineSubtotal).toDecimalPlaces(
              2,
              Prisma.Decimal.ROUND_HALF_UP,
            );
      const taxableAmount = lineSubtotal.sub(appliedDiscount);
      const taxAmount = taxableAmount
        .mul(item.taxRate)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const lineTotal = taxableAmount.add(taxAmount);

      subtotal = subtotal.add(lineSubtotal);
      discountTotal = discountTotal.add(appliedDiscount);
      taxTotal = taxTotal.add(taxAmount);
      calculatedItems.push({
        itemId: item.id,
        itemType: input.itemType,
        name: item.name,
        quantity: quantity.toNumber(),
        unitPrice: this.money(item.price),
        taxRate: Number(item.taxRate),
        discountAmount: this.money(appliedDiscount),
        lineSubtotal: this.money(lineSubtotal),
        taxAmount: this.money(taxAmount),
        lineTotal: this.money(lineTotal),
      });

      if (input.itemType === PosItemType.PRODUCT) {
        const current =
          requestedProductQuantities.get(item.id) ?? new Prisma.Decimal(0);
        requestedProductQuantities.set(item.id, current.add(quantity));
      }
    });

    if (!settings.allowNegativeStock) {
      for (const [productId, quantity] of requestedProductQuantities) {
        const product = productMap.get(productId);
        if (
          product?.trackInventory &&
          quantity.greaterThan(new Prisma.Decimal(product.stock))
        ) {
          errors.push({
            code: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock.toString()}.`,
            itemId: product.id,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      customer,
      items: calculatedItems,
      subtotal: this.money(subtotal),
      taxTotal: this.money(taxTotal),
      discountTotal: this.money(discountTotal),
      total: this.money(subtotal.sub(discountTotal).add(taxTotal)),
    };
  }

  private uniqueIds(items: ValidateCartItemDto[], type: PosItemType) {
    return [
      ...new Set(
        items
          .filter(({ itemType }) => itemType === type)
          .map(({ itemId }) => itemId),
      ),
    ];
  }

  private productResult(product: PosProduct) {
    return {
      id: product.id,
      type: PosItemType.PRODUCT,
      name: product.name,
      description: product.description,
      sku: product.sku,
      barcode: product.barcode,
      price: product.price,
      taxRate: product.taxRate,
      stock: product.stock,
      trackInventory: product.trackInventory,
      allowDiscount: product.allowDiscount,
      status: product.status,
      category: product.category,
      brand: product.brand,
      unit: product.unit,
    };
  }

  private serviceResult(service: PosServiceItem) {
    return {
      id: service.id,
      type: PosItemType.SERVICE,
      name: service.name,
      description: service.description,
      sku: null,
      barcode: null,
      price: service.price,
      taxRate: service.taxRate,
      stock: null,
      trackInventory: false,
      allowDiscount: service.allowDiscount,
      status: service.status,
      category: service.category,
      brand: null,
      unit: null,
    };
  }

  private money(value: Prisma.Decimal | number | string) {
    return Number(new Prisma.Decimal(value).toFixed(2));
  }
}
