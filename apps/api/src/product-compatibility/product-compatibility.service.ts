import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogStatus,
  Prisma,
  ProductAlternativeCodeType,
  ProductCompatibilityGroupStatus,
  ProductSubstituteType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BranchInventoryService } from '../inventory/branch-inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddAlternativeCodeDto,
  AddProductToGroupDto,
  AddSubstituteDto,
  CompatibilityQueryDto,
  CreateCompatibilityGroupDto,
  UpdateCompatibilityGroupDto,
  UpdateCompatibilityGroupStatusDto,
} from './dto/product-compatibility.dto';

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  price: true,
  taxRate: true,
  stock: true,
  trackInventory: true,
  allowDiscount: true,
  brand: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

type ProductSummary = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

@Injectable()
export class ProductCompatibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly branchInventory: BranchInventoryService,
  ) {}

  listGroups(user: AuthUser, query: CompatibilityQueryDto) {
    const search = query.search?.trim();
    return this.prisma.productCompatibilityGroup.findMany({
      where: {
        companyId: user.companyId,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        products: { include: { product: { select: productSelect } } },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 200,
    });
  }

  async createGroup(user: AuthUser, dto: CreateCompatibilityGroupDto) {
    const group = await this.prisma.productCompatibilityGroup
      .create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          code: normalizeCode(dto.code),
          description: dto.description?.trim(),
        },
      })
      .catch((error: unknown) =>
        this.rethrowConflict(error, 'Ya existe un grupo con ese codigo'),
      );
    await this.auditEvent(
      user,
      'PRODUCT_COMPATIBILITY_GROUP_CREATED',
      group.id,
    );
    return group;
  }

  async getGroup(user: AuthUser, id: string) {
    const group = await this.prisma.productCompatibilityGroup.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        products: { include: { product: { select: productSelect } } },
      },
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    return group;
  }

  async updateGroup(
    user: AuthUser,
    id: string,
    dto: UpdateCompatibilityGroupDto,
  ) {
    await this.getGroup(user, id);
    const group = await this.prisma.productCompatibilityGroup
      .update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code ? normalizeCode(dto.code) : undefined,
          description: dto.description?.trim(),
        },
      })
      .catch((error: unknown) =>
        this.rethrowConflict(error, 'Ya existe un grupo con ese codigo'),
      );
    await this.auditEvent(
      user,
      'PRODUCT_COMPATIBILITY_GROUP_UPDATED',
      group.id,
    );
    return group;
  }

  async updateGroupStatus(
    user: AuthUser,
    id: string,
    dto: UpdateCompatibilityGroupStatusDto,
  ) {
    await this.getGroup(user, id);
    const group = await this.prisma.productCompatibilityGroup.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.auditEvent(
      user,
      'PRODUCT_COMPATIBILITY_GROUP_STATUS_CHANGED',
      group.id,
    );
    return group;
  }

  async addProductToGroup(
    user: AuthUser,
    groupId: string,
    dto: AddProductToGroupDto,
  ) {
    const [group, product] = await Promise.all([
      this.getGroup(user, groupId),
      this.ensureProduct(user.companyId, dto.productId),
    ]);
    if (group.status !== ProductCompatibilityGroupStatus.ACTIVE) {
      throw new BadRequestException('El grupo no esta activo');
    }
    const item = await this.prisma.productCompatibilityGroupItem
      .create({
        data: {
          companyId: user.companyId,
          groupId: group.id,
          productId: product.id,
        },
        include: { product: { select: productSelect }, group: true },
      })
      .catch((error: unknown) =>
        this.rethrowConflict(error, 'El producto ya pertenece a este grupo'),
      );
    await this.auditEvent(
      user,
      'PRODUCT_COMPATIBILITY_PRODUCT_ADDED',
      item.id,
      {
        groupId,
        productId: product.id,
      },
    );
    return item;
  }

  async removeProductFromGroup(
    user: AuthUser,
    groupId: string,
    productId: string,
  ) {
    await this.getGroup(user, groupId);
    const deleted = await this.prisma.productCompatibilityGroupItem.deleteMany({
      where: { companyId: user.companyId, groupId, productId },
    });
    if (!deleted.count) throw new NotFoundException('Producto no asignado');
    await this.auditEvent(
      user,
      'PRODUCT_COMPATIBILITY_PRODUCT_REMOVED',
      groupId,
      {
        productId,
      },
    );
    return { success: true };
  }

  listProductCompatibility(user: AuthUser, productId: string) {
    return Promise.all([
      this.listProductGroups(user, productId),
      this.listAlternativeCodes(user, productId),
      this.listSubstitutes(user, productId),
      this.alternativesForProduct(user, productId),
    ]).then(([groups, alternativeCodes, substitutes, alternatives]) => ({
      groups,
      alternativeCodes,
      substitutes,
      alternatives: alternatives.alternatives,
    }));
  }

  async listProductGroups(user: AuthUser, productId: string) {
    await this.ensureProduct(user.companyId, productId);
    return this.prisma.productCompatibilityGroupItem.findMany({
      where: { companyId: user.companyId, productId },
      include: { group: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAlternativeCodes(user: AuthUser, productId: string) {
    await this.ensureProduct(user.companyId, productId);
    return this.prisma.productAlternativeCode.findMany({
      where: { companyId: user.companyId, productId },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async addAlternativeCode(
    user: AuthUser,
    productId: string,
    dto: AddAlternativeCodeDto,
  ) {
    await this.ensureProduct(user.companyId, productId);
    const code = await this.prisma.productAlternativeCode
      .create({
        data: {
          companyId: user.companyId,
          productId,
          code: normalizeCode(dto.code),
          type: dto.type ?? ProductAlternativeCodeType.OTHER,
        },
      })
      .catch((error: unknown) =>
        this.rethrowConflict(error, 'Ya existe ese codigo alterno'),
      );
    await this.auditEvent(user, 'PRODUCT_ALTERNATIVE_CODE_ADDED', code.id, {
      productId,
      code: code.code,
    });
    return code;
  }

  async removeAlternativeCode(
    user: AuthUser,
    productId: string,
    codeId: string,
  ) {
    await this.ensureProduct(user.companyId, productId);
    const deleted = await this.prisma.productAlternativeCode.deleteMany({
      where: { id: codeId, companyId: user.companyId, productId },
    });
    if (!deleted.count)
      throw new NotFoundException('Codigo alterno no encontrado');
    await this.auditEvent(user, 'PRODUCT_ALTERNATIVE_CODE_REMOVED', codeId, {
      productId,
    });
    return { success: true };
  }

  async listSubstitutes(user: AuthUser, productId: string) {
    await this.ensureProduct(user.companyId, productId);
    return this.prisma.productSubstitute.findMany({
      where: {
        companyId: user.companyId,
        OR: [
          { productId },
          { substituteProductId: productId, isBidirectional: true },
        ],
      },
      include: {
        product: { select: productSelect },
        substituteProduct: { select: productSelect },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addSubstitute(
    user: AuthUser,
    productId: string,
    dto: AddSubstituteDto,
  ) {
    if (productId === dto.substituteProductId) {
      throw new BadRequestException(
        'Un producto no puede sustituirse a si mismo',
      );
    }
    await Promise.all([
      this.ensureProduct(user.companyId, productId),
      this.ensureProduct(user.companyId, dto.substituteProductId),
    ]);
    const substitute = await this.prisma.productSubstitute
      .create({
        data: {
          companyId: user.companyId,
          productId,
          substituteProductId: dto.substituteProductId,
          type: dto.type ?? ProductSubstituteType.SUBSTITUTE,
          notes: dto.notes?.trim(),
          isBidirectional: dto.isBidirectional ?? true,
          priority: dto.priority ?? 0,
        },
        include: {
          product: { select: productSelect },
          substituteProduct: { select: productSelect },
        },
      })
      .catch((error: unknown) =>
        this.rethrowConflict(error, 'Ya existe ese sustituto'),
      );
    await this.auditEvent(user, 'PRODUCT_SUBSTITUTE_ADDED', substitute.id, {
      productId,
      substituteProductId: dto.substituteProductId,
      type: substitute.type,
    });
    return substitute;
  }

  async removeSubstitute(
    user: AuthUser,
    productId: string,
    substituteId: string,
  ) {
    await this.ensureProduct(user.companyId, productId);
    const deleted = await this.prisma.productSubstitute.deleteMany({
      where: {
        id: substituteId,
        companyId: user.companyId,
        OR: [
          { productId },
          { substituteProductId: productId, isBidirectional: true },
        ],
      },
    });
    if (!deleted.count) throw new NotFoundException('Sustituto no encontrado');
    await this.auditEvent(user, 'PRODUCT_SUBSTITUTE_REMOVED', substituteId, {
      productId,
    });
    return { success: true };
  }

  async alternativesForProduct(user: AuthUser, productId: string) {
    const requestedProduct = await this.ensureProduct(
      user.companyId,
      productId,
    );
    const [alternatives, stockMap] = await Promise.all([
      this.collectAlternatives(user.companyId, user.branchId, productId),
      this.branchInventory.stockMap(
        this.prisma,
        user.companyId,
        user.branchId,
        [productId],
      ),
    ]);
    return {
      requestedProduct: {
        ...requestedProduct,
        stock: stockMap.get(productId)?.quantity ?? new Prisma.Decimal(0),
      },
      alternatives,
    };
  }

  async alternativesByCode(user: AuthUser, query: string) {
    const code = normalizeCode(query);
    if (!code) return { requestedProduct: null, alternatives: [] };
    const exactProduct = await this.prisma.product.findFirst({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: CatalogStatus.ACTIVE,
        OR: [
          { sku: { equals: code, mode: 'insensitive' } },
          { barcode: { equals: code, mode: 'insensitive' } },
        ],
      },
      select: productSelect,
    });
    if (exactProduct) return this.alternativesForProduct(user, exactProduct.id);

    const alternativeCode = await this.prisma.productAlternativeCode.findFirst({
      where: {
        companyId: user.companyId,
        code: { equals: code, mode: 'insensitive' },
      },
      include: { product: { select: productSelect } },
    });
    if (!alternativeCode) return { requestedProduct: null, alternatives: [] };
    const result = await this.alternativesForProduct(
      user,
      alternativeCode.productId,
    );
    const stockMap = await this.branchInventory.stockMap(
      this.prisma,
      user.companyId,
      user.branchId,
      [alternativeCode.product.id],
    );
    const exactStock = stockMap.get(alternativeCode.product.id)?.quantity;
    const exactAlternative =
      Number(exactStock ?? 0) > 0
        ? [
            toAlternative(
              { ...alternativeCode.product, stock: exactStock! },
              'Codigo alterno/OEM registrado',
              'EQUIVALENT',
            ),
          ]
        : [];
    return {
      requestedProduct: result.requestedProduct,
      alternatives: [...exactAlternative, ...result.alternatives].filter(
        (item, index, list) =>
          list.findIndex(({ id }) => id === item.id) === index,
      ),
    };
  }

  private async collectAlternatives(
    companyId: string,
    branchId: string | null,
    productId: string,
  ) {
    const [substitutes, groupItems, alternativeCodes] = await Promise.all([
      this.prisma.productSubstitute.findMany({
        where: {
          companyId,
          OR: [
            { productId },
            { substituteProductId: productId, isBidirectional: true },
          ],
        },
        include: {
          product: { select: productSelect },
          substituteProduct: { select: productSelect },
        },
      }),
      this.prisma.productCompatibilityGroupItem.findMany({
        where: {
          companyId,
          productId,
          group: { status: ProductCompatibilityGroupStatus.ACTIVE },
        },
        include: {
          group: {
            include: {
              products: {
                where: { productId: { not: productId } },
                include: { product: { select: productSelect } },
              },
            },
          },
        },
      }),
      this.prisma.productAlternativeCode.findMany({
        where: { companyId, productId },
        select: { code: true },
      }),
    ]);
    const byId = new Map<string, ReturnType<typeof toAlternative>>();
    for (const substitute of substitutes) {
      const target =
        substitute.productId === productId
          ? substitute.substituteProduct
          : substitute.product;
      addAlternative(
        byId,
        target,
        substitute.productId === productId
          ? 'Sustituto registrado'
          : 'Sustituto bidireccional registrado',
        substitute.type,
      );
    }
    for (const item of groupItems) {
      for (const candidate of item.group.products) {
        addAlternative(
          byId,
          candidate.product,
          `Mismo grupo de compatibilidad: ${item.group.code}`,
          ProductSubstituteType.EQUIVALENT,
        );
      }
    }
    const codes = alternativeCodes.map(({ code }) => code);
    if (codes.length) {
      const linked = await this.prisma.productAlternativeCode.findMany({
        where: {
          companyId,
          code: { in: codes },
          productId: { not: productId },
          product: { deletedAt: null, status: CatalogStatus.ACTIVE },
        },
        include: { product: { select: productSelect } },
      });
      for (const item of linked) {
        addAlternative(
          byId,
          item.product,
          `Codigo alterno compartido: ${item.code}`,
          ProductSubstituteType.EQUIVALENT,
        );
      }
    }
    const stockMap = await this.branchInventory.stockMap(
      this.prisma,
      companyId,
      branchId,
      [...byId.keys()],
    );
    return [...byId.values()]
      .map((item) => ({
        ...item,
        stock: stockMap.get(item.id)?.quantity ?? new Prisma.Decimal(0),
      }))
      .filter((item) => Number(item.stock) > 0)
      .sort(
        (left, right) =>
          Number(right.stock) - Number(left.stock) ||
          left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }),
      );
  }

  private async ensureProduct(companyId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
        deletedAt: null,
        status: CatalogStatus.ACTIVE,
      },
      select: productSelect,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  private auditEvent(
    user: AuthUser,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action,
      module: 'product_compatibility',
      entityType: 'ProductCompatibility',
      entityId,
      description: action,
      metadata,
    });
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}

function addAlternative(
  map: Map<string, ReturnType<typeof toAlternative>>,
  product: ProductSummary,
  reason: string,
  relationType: string,
) {
  map.set(product.id, toAlternative(product, reason, relationType));
}

function toAlternative(
  product: ProductSummary,
  reason: string,
  relationType: string,
) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    price: product.price,
    taxRate: product.taxRate,
    stock: product.stock,
    trackInventory: product.trackInventory,
    allowDiscount: product.allowDiscount,
    brand: product.brand,
    reason,
    relationType,
  };
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}
