import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CashSessionStatus,
  CustomerStatus,
  InternalDocumentStatus,
  InternalDocumentType,
  Prisma,
  SaleStatus,
} from '@prisma/client';

import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

type DateRange = { from: Date; to: Date };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const branch = await this.activeBranch(user);
    const [
      salesSummary,
      cashSummary,
      customersCount,
      lowStockCount,
      docsCount,
    ] = await Promise.all([
      this.salesSummary(user, range),
      this.cashTotals(user, range),
      this.prisma.customer.count({
        where: { companyId: user.companyId, deletedAt: null },
      }),
      this.lowStockCount(user),
      this.prisma.internalDocument.count({
        where: this.documentWhere(user, range),
      }),
    ]);

    return {
      totalSales: salesSummary.total,
      salesCount: salesSummary.count,
      averageTicket: salesSummary.averageTicket,
      cashTotal: cashSummary.cashSalesTotal,
      customersCount,
      lowStockCount,
      internalDocumentsCount: docsCount,
      activeBranch: branch,
      dateRange: this.publicRange(range),
    };
  }

  async sales(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const where = this.saleWhere(user, range);
    const [summary, sales] = await Promise.all([
      this.salesSummary(user, range),
      this.prisma.sale.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        include: {
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);
    return {
      ...summary,
      items: sales.map((sale) => ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        date: sale.createdAt,
        customer: sale.customer,
        user: sale.createdBy,
        branch: sale.branch,
        status: sale.status,
        total: this.money(sale.total),
        paid: this.money(sale.paidTotal),
        balance: this.money(sale.balanceDue),
      })),
      dateRange: this.publicRange(range),
    };
  }

  async salesByDay(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const branchId = this.branchId(user);
    const rows = await this.prisma.$queryRaw<
      Array<{ date: Date; sales_count: bigint; total: Prisma.Decimal | null }>
    >(Prisma.sql`
      SELECT date_trunc('day', "createdAt")::date AS date,
             count(*)::bigint AS sales_count,
             coalesce(sum(total), 0) AS total
      FROM "sales"
      WHERE "companyId" = ${user.companyId}
        AND "branchId" = ${branchId}
        AND "createdAt" >= ${range.from}
        AND "createdAt" <= ${range.to}
        AND status = 'COMPLETED'
      GROUP BY date
      ORDER BY date ASC
    `);
    return {
      items: rows.map((row) => ({
        date: row.date,
        salesCount: Number(row.sales_count),
        total: this.money(row.total ?? 0),
      })),
      dateRange: this.publicRange(range),
    };
  }

  async salesByUser(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const rows = await this.prisma.sale.groupBy({
      by: ['createdById'],
      where: { ...this.saleWhere(user, range), status: SaleStatus.COMPLETED },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.createdById) } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((item) => [item.id, item.name]));
    return {
      items: rows.map((row) => ({
        userId: row.createdById,
        userName: userMap.get(row.createdById) ?? 'Usuario',
        salesCount: row._count._all,
        total: this.money(row._sum.total ?? 0),
      })),
      dateRange: this.publicRange(range),
    };
  }

  async topProducts(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const branchId = this.branchId(user);
    const rows = await this.prisma.$queryRaw<
      Array<{
        item_id: string;
        name: string;
        quantity_sold: Prisma.Decimal;
        total_sold: Prisma.Decimal;
      }>
    >(Prisma.sql`
      SELECT coalesce(si."productId", si."serviceId") AS item_id,
             si.name,
             coalesce(sum(si.quantity), 0) AS quantity_sold,
             coalesce(sum(si.total), 0) AS total_sold
      FROM "sale_items" si
      INNER JOIN "sales" s ON s.id = si."saleId"
      WHERE si."companyId" = ${user.companyId}
        AND s."branchId" = ${branchId}
        AND s."createdAt" >= ${range.from}
        AND s."createdAt" <= ${range.to}
        AND s.status = 'COMPLETED'
      GROUP BY item_id, si.name
      ORDER BY total_sold DESC
      LIMIT 10
    `);
    return {
      items: rows.map((row) => ({
        productId: row.item_id,
        name: row.name,
        quantitySold: Number(row.quantity_sold),
        totalSold: this.money(row.total_sold),
      })),
      dateRange: this.publicRange(range),
    };
  }

  async cash(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const where = this.cashWhere(user, range);
    const [totals, sessions] = await Promise.all([
      this.cashTotals(user, range),
      this.prisma.cashSession.findMany({
        where,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    ]);
    return {
      ...totals,
      sessions: sessions.map((session) => ({
        id: session.id,
        status: session.status,
        branch: session.branch,
        openedBy: session.openedBy,
        closedBy: session.closedBy,
        openingAmount: this.money(session.openingAmount),
        expectedCashAmount: this.money(session.expectedCashAmount),
        countedCashAmount:
          session.countedCashAmount === null
            ? null
            : this.money(session.countedCashAmount),
        differenceAmount:
          session.differenceAmount === null
            ? null
            : this.money(session.differenceAmount),
        openedAt: session.openedAt,
        closedAt: session.closedAt,
      })),
      dateRange: this.publicRange(range),
    };
  }

  async customers(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      topRows,
      recent,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: { companyId: user.companyId, deletedAt: null },
      }),
      this.prisma.customer.count({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          status: CustomerStatus.ACTIVE,
        },
      }),
      this.prisma.customer.count({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          status: CustomerStatus.INACTIVE,
        },
      }),
      this.topCustomers(user, range),
      this.prisma.customer.findMany({
        where: { companyId: user.companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          documentNumber: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      topCustomersBySales: topRows,
      recentCustomers: recent,
      dateRange: this.publicRange(range),
    };
  }

  async lowStock(user: AuthUser) {
    if (user.branchId) {
      const items = await this.prisma.productBranchStock.findMany({
        where: {
          companyId: user.companyId,
          branchId: user.branchId,
          product: {
            deletedAt: null,
            trackInventory: true,
            status: 'ACTIVE',
          },
          quantity: { lte: this.prisma.productBranchStock.fields.minStock },
        },
        orderBy: [{ quantity: 'asc' }],
        take: 100,
        include: {
          product: {
            select: { id: true, name: true, sku: true, status: true },
          },
          branch: { select: { id: true, name: true, code: true } },
        },
      });
      return {
        items: items.map((item) => ({
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          currentStock: Number(item.quantity),
          minStock: Number(item.minStock),
          status: item.product.status,
          branch: item.branch,
        })),
        scope: 'branch_inventory',
      };
    }

    const items = await this.prisma.product.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        trackInventory: true,
        stock: { lte: this.prisma.product.fields.minStock },
      },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take: 100,
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        status: true,
      },
    });
    return {
      items: items.map((item) => ({
        productId: item.id,
        name: item.name,
        sku: item.sku,
        currentStock: Number(item.stock),
        minStock: Number(item.minStock),
        status: item.status,
      })),
      scope: 'company_inventory',
    };
  }

  async documents(user: AuthUser, query: ReportsQueryDto) {
    const range = this.dateRange(query);
    const where = this.documentWhere(user, range);
    const [totalDocuments, byStatus, byType, recentDocuments] =
      await Promise.all([
        this.prisma.internalDocument.count({ where }),
        this.prisma.internalDocument.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.internalDocument.groupBy({
          by: ['documentType'],
          where,
          _count: { _all: true },
        }),
        this.prisma.internalDocument.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true, code: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 30,
        }),
      ]);
    return {
      totalDocuments,
      documentsByStatus: Object.fromEntries(
        Object.values(InternalDocumentStatus).map((status) => [
          status,
          byStatus.find((row) => row.status === status)?._count._all ?? 0,
        ]),
      ),
      documentsByType: Object.fromEntries(
        Object.values(InternalDocumentType).map((type) => [
          type,
          byType.find((row) => row.documentType === type)?._count._all ?? 0,
        ]),
      ),
      recentDocuments: recentDocuments.map((document) => ({
        id: document.id,
        documentNumber: document.documentNumber,
        documentType: document.documentType,
        status: document.status,
        customer: document.customer,
        branch: document.branch,
        total: this.money(document.total),
        createdAt: document.createdAt,
      })),
      dateRange: this.publicRange(range),
    };
  }

  private async salesSummary(user: AuthUser, range: DateRange) {
    const [aggregate, cancelledCount] = await Promise.all([
      this.prisma.sale.aggregate({
        where: this.saleWhere(user, range),
        _count: { _all: true },
        _sum: { total: true, paidTotal: true, balanceDue: true },
        _avg: { total: true },
      }),
      this.prisma.sale.count({
        where: { ...this.saleWhere(user, range), status: SaleStatus.CANCELLED },
      }),
    ]);
    return {
      total: this.money(aggregate._sum.total ?? 0),
      count: aggregate._count._all,
      averageTicket: this.money(aggregate._avg.total ?? 0),
      cancelledCount,
      paidAmount: this.money(aggregate._sum.paidTotal ?? 0),
      balance: this.money(aggregate._sum.balanceDue ?? 0),
    };
  }

  private async cashTotals(user: AuthUser, range: DateRange) {
    const where = this.cashWhere(user, range);
    const [aggregate, sessionsCount, openedSessions, closedSessions] =
      await Promise.all([
        this.prisma.cashSession.aggregate({
          where,
          _sum: {
            openingAmount: true,
            salesCashTotal: true,
            manualInTotal: true,
            manualOutTotal: true,
            expectedCashAmount: true,
            countedCashAmount: true,
            differenceAmount: true,
          },
        }),
        this.prisma.cashSession.count({ where }),
        this.prisma.cashSession.count({
          where: { ...where, status: CashSessionStatus.OPEN },
        }),
        this.prisma.cashSession.count({
          where: { ...where, status: CashSessionStatus.CLOSED },
        }),
      ]);
    return {
      sessionsCount,
      openedSessions,
      closedSessions,
      openingTotal: this.money(aggregate._sum.openingAmount ?? 0),
      cashSalesTotal: this.money(aggregate._sum.salesCashTotal ?? 0),
      manualInTotal: this.money(aggregate._sum.manualInTotal ?? 0),
      manualOutTotal: this.money(aggregate._sum.manualOutTotal ?? 0),
      expectedCashTotal: this.money(aggregate._sum.expectedCashAmount ?? 0),
      countedCashTotal: this.money(aggregate._sum.countedCashAmount ?? 0),
      differenceTotal: this.money(aggregate._sum.differenceAmount ?? 0),
    };
  }

  private async topCustomers(user: AuthUser, range: DateRange) {
    const branchId = this.branchId(user);
    const rows = await this.prisma.$queryRaw<
      Array<{
        customer_id: string;
        customer_name: string;
        sales_count: bigint;
        total: Prisma.Decimal;
      }>
    >(Prisma.sql`
      SELECT c.id AS customer_id,
             c.name AS customer_name,
             count(s.id)::bigint AS sales_count,
             coalesce(sum(s.total), 0) AS total
      FROM "sales" s
      INNER JOIN "customers" c ON c.id = s."customerId"
      WHERE s."companyId" = ${user.companyId}
        AND s."branchId" = ${branchId}
        AND s."createdAt" >= ${range.from}
        AND s."createdAt" <= ${range.to}
        AND s.status = 'COMPLETED'
      GROUP BY c.id, c.name
      ORDER BY total DESC
      LIMIT 10
    `);
    return rows.map((row) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      salesCount: Number(row.sales_count),
      total: this.money(row.total),
    }));
  }

  private async lowStockCount(user: AuthUser) {
    if (user.branchId) {
      return this.prisma.productBranchStock.count({
        where: {
          companyId: user.companyId,
          branchId: user.branchId,
          product: {
            deletedAt: null,
            trackInventory: true,
            status: 'ACTIVE',
          },
          quantity: { lte: this.prisma.productBranchStock.fields.minStock },
        },
      });
    }
    return this.prisma.product.count({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        trackInventory: true,
        stock: { lte: this.prisma.product.fields.minStock },
      },
    });
  }

  private saleWhere(user: AuthUser, range: DateRange): Prisma.SaleWhereInput {
    return {
      companyId: user.companyId,
      branchId: this.branchId(user),
      createdAt: { gte: range.from, lte: range.to },
    };
  }

  private cashWhere(
    user: AuthUser,
    range: DateRange,
  ): Prisma.CashSessionWhereInput {
    return {
      companyId: user.companyId,
      branchId: this.branchId(user),
      openedAt: { gte: range.from, lte: range.to },
    };
  }

  private documentWhere(
    user: AuthUser,
    range: DateRange,
  ): Prisma.InternalDocumentWhereInput {
    return {
      companyId: user.companyId,
      branchId: this.branchId(user),
      createdAt: { gte: range.from, lte: range.to },
    };
  }

  private branchId(user: AuthUser) {
    if (!user.branchId) {
      throw new BadRequestException('Se requiere una sucursal activa');
    }
    return user.branchId;
  }

  private activeBranch(user: AuthUser) {
    if (!user.branchId) return null;
    return this.prisma.branch.findFirst({
      where: { id: user.branchId, companyId: user.companyId },
      select: { id: true, code: true, name: true, isMain: true },
    });
  }

  private dateRange(query: ReportsQueryDto): DateRange {
    const now = new Date();
    const from = query.from ? new Date(query.from) : this.startOfDay(now);
    const to = query.to ? new Date(query.to) : this.endOfDay(now);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Rango de fechas invalido');
    }
    if (from > to) {
      throw new BadRequestException('La fecha inicial no puede ser mayor');
    }
    return { from, to };
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  }

  private publicRange(range: DateRange) {
    return { from: range.from.toISOString(), to: range.to.toISOString() };
  }

  private money(value: Prisma.Decimal | number | string) {
    return Number(new Prisma.Decimal(value).toFixed(2));
  }
}
