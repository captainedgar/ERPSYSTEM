import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryType, type Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { rethrowCatalogConflict } from '../catalog/catalog-errors';
import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productInclude = {
  category: { select: { id: true, name: true, type: true } },
  brand: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser, query: ProductQueryDto) {
    return this.prisma.product.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: query.status,
        categoryId: query.categoryId,
        brandId: query.brandId,
        OR: query.search
          ? [
              {
                name: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                sku: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                barcode: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
      },
      include: productInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(user: AuthUser, dto: CreateProductDto) {
    await this.validateRelations(user.companyId, dto);
    try {
      const product = await this.prisma.product.create({
        data: {
          companyId: user.companyId,
          ...this.data(dto),
          name: dto.name.trim(),
          price: dto.price,
        },
        include: productInclude,
      });
      await this.auditEvent(user, product.id, 'PRODUCT_CREATED');
      return product;
    } catch (error) {
      rethrowCatalogConflict(error, 'Product SKU or barcode already exists');
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateProductDto) {
    await this.findOne(user, id);
    await this.validateRelations(user.companyId, dto);
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: this.data(dto),
        include: productInclude,
      });
      await this.auditEvent(user, product.id, 'PRODUCT_UPDATED');
      return product;
    } catch (error) {
      rethrowCatalogConflict(error, 'Product SKU or barcode already exists');
    }
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateCatalogStatusDto) {
    await this.findOne(user, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: dto.status },
      include: productInclude,
    });
    await this.auditEvent(user, product.id, 'PRODUCT_STATUS_CHANGED');
    return product;
  }

  private data(dto: UpdateProductDto) {
    return {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      sku: dto.sku?.trim(),
      barcode: dto.barcode?.trim(),
      categoryId: dto.categoryId,
      brandId: dto.brandId,
      unitId: dto.unitId,
      cost: dto.cost,
      price: dto.price,
      taxRate: dto.taxRate,
      stock: dto.stock,
      minStock: dto.minStock,
      trackInventory: dto.trackInventory,
      allowDiscount: dto.allowDiscount,
      imageUrl: dto.imageUrl?.trim(),
    };
  }

  private async validateRelations(
    companyId: string,
    dto: Pick<CreateProductDto, 'categoryId' | 'brandId' | 'unitId'>,
  ) {
    const [category, brand, unit] = await Promise.all([
      dto.categoryId
        ? this.prisma.category.findFirst({
            where: {
              id: dto.categoryId,
              companyId,
              deletedAt: null,
              status: 'ACTIVE',
              type: { in: [CategoryType.PRODUCT, CategoryType.BOTH] },
            },
          })
        : Promise.resolve(true),
      dto.brandId
        ? this.prisma.brand.findFirst({
            where: {
              id: dto.brandId,
              companyId,
              deletedAt: null,
              status: 'ACTIVE',
            },
          })
        : Promise.resolve(true),
      dto.unitId
        ? this.prisma.unit.findFirst({
            where: { id: dto.unitId, companyId, status: 'ACTIVE' },
          })
        : Promise.resolve(true),
    ]);
    if (!category) throw new BadRequestException('Invalid product category');
    if (!brand) throw new BadRequestException('Invalid product brand');
    if (!unit) throw new BadRequestException('Invalid product unit');
  }

  private auditEvent(user: AuthUser, entityId: string, action: string) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action,
      module: 'products',
      entityType: 'Product',
      entityId,
      description: action,
    });
  }
}
