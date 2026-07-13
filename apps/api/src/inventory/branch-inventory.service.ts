import { BadRequestException, Injectable } from '@nestjs/common';
import { BranchStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type PrismaInventoryClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class BranchInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureActiveBranch(companyId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        deletedAt: null,
        status: BranchStatus.ACTIVE,
      },
      select: { id: true, name: true, code: true },
    });
    if (!branch) {
      throw new BadRequestException('La sucursal no esta disponible');
    }
    return branch;
  }

  async ensureStock(
    client: PrismaInventoryClient,
    companyId: string,
    branchId: string,
    productId: string,
    defaults: {
      quantity?: Prisma.Decimal.Value;
      minStock?: Prisma.Decimal.Value;
    } = {},
  ) {
    return client.productBranchStock.upsert({
      where: {
        companyId_branchId_productId: { companyId, branchId, productId },
      },
      update: {},
      create: {
        companyId,
        branchId,
        productId,
        quantity: defaults.quantity ?? 0,
        minStock: defaults.minStock ?? 0,
      },
    });
  }

  async stockMap(
    client: PrismaInventoryClient,
    companyId: string,
    branchId: string | null,
    productIds: string[],
  ) {
    if (!branchId || !productIds.length) return new Map<string, BranchStock>();
    const rows = await client.productBranchStock.findMany({
      where: { companyId, branchId, productId: { in: productIds } },
    });
    return new Map(rows.map((row) => [row.productId, row]));
  }
}

type BranchStock = Awaited<
  ReturnType<Prisma.ProductBranchStockDelegate['findFirstOrThrow']>
>;
