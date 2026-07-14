import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PaymentMethod, Prisma, SaleStatus, UserRole } from '@prisma/client';

import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  FinancialDashboardQueryDto,
  FinancialDashboardScope,
} from './dto/financial-dashboard-query.dto';

type Range = { from: Date; to: Date };
type Context = Range & {
  previous: Range;
  branchId?: string;
  scope: FinancialDashboardScope;
};

@Injectable()
export class FinancialDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const previousContext = {
      ...context,
      from: context.previous.from,
      to: context.previous.to,
      previous: context.previous,
    };
    const [current, previous, branch] = await Promise.all([
      this.salesMetrics(user, context),
      this.salesMetrics(user, previousContext),
      context.branchId
        ? this.prisma.branch.findFirst({
            where: { id: context.branchId, companyId: user.companyId },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      ...current,
      activeBranch: branch,
      dateRange: { from: context.from, to: context.to },
      comparison: {
        previousGrossSales: previous.grossSales,
        grossSalesChangePercent: percentChange(
          current.grossSales,
          previous.grossSales,
        ),
        previousSalesCount: previous.salesCount,
        salesCountChangePercent: percentChange(
          current.salesCount,
          previous.salesCount,
        ),
        previousAverageTicket: previous.averageTicket,
        averageTicketChangePercent: percentChange(
          current.averageTicket,
          previous.averageTicket,
        ),
      },
    };
  }

  async salesTrend(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const sales = await this.prisma.sale.findMany({
      where: { ...this.saleWhere(user, context), status: SaleStatus.COMPLETED },
      select: { createdAt: true, total: true, paidTotal: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay = new Map<
      string,
      { count: number; gross: number; paid: number }
    >();
    for (const sale of sales) {
      const date = sale.createdAt.toISOString().slice(0, 10);
      const current = byDay.get(date) ?? { count: 0, gross: 0, paid: 0 };
      current.count += 1;
      current.gross += Number(sale.total);
      current.paid += Number(sale.paidTotal);
      byDay.set(date, current);
    }
    return {
      items: [...byDay.entries()].map(([date, item]) => ({
        date,
        salesCount: item.count,
        grossSales: money(item.gross),
        netSales: money(item.gross),
        cashCollected: money(item.paid),
        averageTicket: money(safeDivide(item.gross, item.count)),
      })),
      dateRange: { from: context.from, to: context.to },
    };
  }

  async paymentMethods(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        companyId: user.companyId,
        sale: this.saleWhere(user, context),
        createdAt: { gte: context.from, lte: context.to },
      },
      _count: { _all: true },
      _sum: { amount: true },
    });
    const total = payments.reduce(
      (sum, item) => sum + Number(item._sum.amount ?? 0),
      0,
    );
    return {
      items: payments.map((item) => ({
        paymentMethod: item.method,
        label: paymentLabel(item.method),
        count: item._count._all,
        amount: money(item._sum.amount ?? 0),
        percentage: money(
          total ? (Number(item._sum.amount ?? 0) / total) * 100 : 0,
        ),
      })),
    };
  }

  async branches(user: AuthUser, query: FinancialDashboardQueryDto) {
    this.assertAllBranches(user);
    const context = this.context(user, {
      ...query,
      scope: FinancialDashboardScope.ALL_BRANCHES,
    });
    const branches = await this.prisma.branch.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });
    const rows = await Promise.all(
      branches.map(async (branch) => {
        const metrics = await this.salesMetrics(user, {
          ...context,
          branchId: branch.id,
        });
        return {
          branchId: branch.id,
          branchName: branch.name,
          salesCount: metrics.salesCount,
          grossSales: metrics.grossSales,
          netSales: metrics.netSales,
          averageTicket: metrics.averageTicket,
          cashCollected: metrics.cashCollected,
          cancelledSales: metrics.cancelledSales,
        };
      }),
    );
    return { items: rows };
  }

  async topProducts(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const items = await this.prisma.saleItem.findMany({
      where: {
        companyId: user.companyId,
        productId: { not: null },
        sale: {
          ...this.saleWhere(user, context),
          status: SaleStatus.COMPLETED,
        },
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, cost: true },
        },
      },
    });
    const byProduct = new Map<
      string,
      {
        productId: string;
        name: string;
        sku: string | null;
        quantity: number;
        gross: number;
        cost: number;
      }
    >();
    for (const item of items) {
      if (!item.productId || !item.product) continue;
      const current = byProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        quantity: 0,
        gross: 0,
        cost: 0,
      };
      const quantity = Number(item.quantity);
      current.quantity += quantity;
      current.gross += Number(item.total);
      current.cost += quantity * Number(item.product.cost);
      byProduct.set(item.productId, current);
    }
    const stockMap = await this.stockMap(user.companyId, context.branchId, [
      ...byProduct.keys(),
    ]);
    return {
      items: [...byProduct.values()]
        .sort((left, right) => right.gross - left.gross)
        .slice(0, 10)
        .map((item) => ({
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantitySold: money(item.quantity),
          grossSales: money(item.gross),
          estimatedCost: money(item.cost),
          estimatedProfit: money(item.gross - item.cost),
          stockInActiveBranch: Number(
            stockMap.get(item.productId)?.quantity ?? 0,
          ),
        })),
    };
  }

  async topCustomers(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const sales = await this.prisma.sale.findMany({
      where: {
        ...this.saleWhere(user, context),
        status: SaleStatus.COMPLETED,
        customerId: { not: null },
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    const byCustomer = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        count: number;
        total: number;
        last: Date;
        balance: number;
      }
    >();
    for (const sale of sales) {
      if (!sale.customerId || !sale.customer) continue;
      const current = byCustomer.get(sale.customerId) ?? {
        customerId: sale.customerId,
        customerName: sale.customer.name,
        count: 0,
        total: 0,
        last: sale.createdAt,
        balance: 0,
      };
      current.count += 1;
      current.total += Number(sale.total);
      current.balance += Number(sale.balanceDue);
      if (sale.createdAt > current.last) current.last = sale.createdAt;
      byCustomer.set(sale.customerId, current);
    }
    return {
      items: [...byCustomer.values()]
        .sort((left, right) => right.total - left.total)
        .slice(0, 10)
        .map((item) => ({
          customerId: item.customerId,
          customerName: item.customerName,
          salesCount: item.count,
          totalPurchased: money(item.total),
          lastPurchaseAt: item.last,
          pendingBalance: money(item.balance),
        })),
    };
  }

  async cashHealth(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        companyId: user.companyId,
        branchId: context.branchId ?? undefined,
        openedAt: { gte: context.from, lte: context.to },
      },
    });
    const differences = sessions.map((session) =>
      Math.abs(Number(session.differenceAmount ?? 0)),
    );
    return {
      openSessions: sessions.filter((item) => item.status === 'OPEN').length,
      closedSessions: sessions.filter((item) => item.status === 'CLOSED')
        .length,
      expectedCash: money(
        sum(sessions, (item) => Number(item.expectedCashAmount)),
      ),
      countedCash: money(
        sum(sessions, (item) => Number(item.countedCashAmount ?? 0)),
      ),
      differenceTotal: money(
        sum(sessions, (item) => Number(item.differenceAmount ?? 0)),
      ),
      manualIn: money(sum(sessions, (item) => Number(item.manualInTotal))),
      manualOut: money(sum(sessions, (item) => Number(item.manualOutTotal))),
      cashSales: money(sum(sessions, (item) => Number(item.salesCashTotal))),
      sessionsWithDifference: differences.filter((value) => value > 0).length,
      largestDifference: money(Math.max(0, ...differences)),
    };
  }

  async inventoryValue(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const stocks = await this.prisma.productBranchStock.findMany({
      where: {
        companyId: user.companyId,
        branchId: context.branchId ?? undefined,
        product: { deletedAt: null, trackInventory: true },
      },
      include: {
        branch: { select: { id: true, name: true } },
        product: { select: { cost: true, price: true } },
      },
    });
    const inventoryCostValue = sum(
      stocks,
      (item) => Number(item.quantity) * Number(item.product.cost),
    );
    const inventorySaleValue = sum(
      stocks,
      (item) => Number(item.quantity) * Number(item.product.price),
    );
    const byBranch = new Map<
      string,
      {
        branchId: string;
        branchName: string;
        cost: number;
        sale: number;
        products: number;
      }
    >();
    for (const stock of stocks) {
      const current = byBranch.get(stock.branchId) ?? {
        branchId: stock.branchId,
        branchName: stock.branch.name,
        cost: 0,
        sale: 0,
        products: 0,
      };
      current.cost += Number(stock.quantity) * Number(stock.product.cost);
      current.sale += Number(stock.quantity) * Number(stock.product.price);
      current.products += Number(stock.quantity) > 0 ? 1 : 0;
      byBranch.set(stock.branchId, current);
    }
    return {
      totalProducts: stocks.length,
      productsWithStock: stocks.filter((item) => Number(item.quantity) > 0)
        .length,
      productsWithoutStock: stocks.filter((item) => Number(item.quantity) <= 0)
        .length,
      lowStockProducts: stocks.filter(
        (item) => Number(item.quantity) <= Number(item.minStock),
      ).length,
      inventoryCostValue: money(inventoryCostValue),
      inventorySaleValue: money(inventorySaleValue),
      estimatedPotentialMargin: money(
        inventorySaleValue
          ? ((inventorySaleValue - inventoryCostValue) / inventorySaleValue) *
              100
          : 0,
      ),
      stockByBranch:
        context.scope === FinancialDashboardScope.ALL_BRANCHES
          ? [...byBranch.values()].map((item) => ({
              branchId: item.branchId,
              branchName: item.branchName,
              inventoryCostValue: money(item.cost),
              inventorySaleValue: money(item.sale),
              productsWithStock: item.products,
            }))
          : [],
    };
  }

  async alerts(user: AuthUser, query: FinancialDashboardQueryDto) {
    const context = this.context(user, query);
    const [noStock, lowStock, cancelled, cashDiff, pendingBalance] =
      await Promise.all([
        this.prisma.productBranchStock.count({
          where: {
            companyId: user.companyId,
            branchId: context.branchId ?? undefined,
            quantity: { lte: 0 },
            product: { deletedAt: null },
          },
        }),
        this.prisma.productBranchStock.count({
          where: {
            companyId: user.companyId,
            branchId: context.branchId ?? undefined,
            quantity: {
              gt: 0,
              lte: this.prisma.productBranchStock.fields.minStock,
            },
            product: { deletedAt: null },
          },
        }),
        this.prisma.sale.count({
          where: {
            ...this.saleWhere(user, context),
            status: SaleStatus.CANCELLED,
          },
        }),
        this.prisma.cashSession.count({
          where: {
            companyId: user.companyId,
            branchId: context.branchId ?? undefined,
            openedAt: { gte: context.from, lte: context.to },
            differenceAmount: { not: null },
          },
        }),
        this.prisma.sale.count({
          where: { ...this.saleWhere(user, context), balanceDue: { gt: 0 } },
        }),
      ]);
    return {
      items: [
        alert(
          'OUT_OF_STOCK',
          'danger',
          'Productos sin stock',
          'Productos sin disponibilidad en el inventario operativo.',
          noStock,
          '/inventory',
        ),
        alert(
          'LOW_STOCK',
          'warning',
          'Productos bajo minimo',
          'Productos por debajo del minimo configurado.',
          lowStock,
          '/inventory/low-stock',
        ),
        alert(
          'CANCELLED_SALES',
          'warning',
          'Ventas canceladas',
          'Ventas anuladas durante el periodo.',
          cancelled,
          '/sales',
        ),
        alert(
          'CASH_DIFFERENCE',
          'warning',
          'Diferencias de caja',
          'Sesiones con diferencia registrada.',
          cashDiff,
          '/cash/sessions',
        ),
        alert(
          'PENDING_BALANCE',
          'info',
          'Balances pendientes',
          'Ventas con balance pendiente.',
          pendingBalance,
          '/sales',
        ),
      ],
    };
  }

  private async salesMetrics(user: AuthUser, context: Context) {
    const [completed, cancelled, items] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          ...this.saleWhere(user, context),
          status: SaleStatus.COMPLETED,
        },
        _count: { _all: true },
        _sum: {
          total: true,
          paidTotal: true,
          balanceDue: true,
          discountTotal: true,
          taxTotal: true,
        },
      }),
      this.prisma.sale.count({
        where: {
          ...this.saleWhere(user, context),
          status: SaleStatus.CANCELLED,
        },
      }),
      this.prisma.saleItem.findMany({
        where: {
          companyId: user.companyId,
          sale: {
            ...this.saleWhere(user, context),
            status: SaleStatus.COMPLETED,
          },
        },
        include: { product: { select: { cost: true } } },
      }),
    ]);
    const grossSales = Number(completed._sum.total ?? 0);
    const salesCount = completed._count._all;
    const estimatedCost = sum(
      items,
      (item) => Number(item.quantity) * Number(item.product?.cost ?? 0),
    );
    const estimatedGrossProfit = grossSales - estimatedCost;
    return {
      grossSales: money(grossSales),
      netSales: money(grossSales),
      salesCount,
      cancelledSales: cancelled,
      averageTicket: money(safeDivide(grossSales, salesCount)),
      cashCollected: money(completed._sum.paidTotal ?? 0),
      pendingBalance: money(completed._sum.balanceDue ?? 0),
      discountTotal: money(completed._sum.discountTotal ?? 0),
      taxTotal: money(completed._sum.taxTotal ?? 0),
      estimatedCost: money(estimatedCost),
      estimatedGrossProfit: money(estimatedGrossProfit),
      estimatedGrossMargin: money(
        grossSales ? (estimatedGrossProfit / grossSales) * 100 : 0,
      ),
    };
  }

  private saleWhere(
    user: AuthUser,
    context: Pick<Context, 'from' | 'to' | 'branchId'>,
  ): Prisma.SaleWhereInput {
    return {
      companyId: user.companyId,
      branchId: context.branchId ?? undefined,
      createdAt: { gte: context.from, lte: context.to },
    };
  }

  private context(user: AuthUser, query: FinancialDashboardQueryDto): Context {
    const scope = query.scope ?? FinancialDashboardScope.ACTIVE_BRANCH;
    if (scope === FinancialDashboardScope.ALL_BRANCHES) {
      this.assertAllBranches(user);
    }
    const range = dateRange(query);
    return {
      ...range,
      previous: previousRange(range),
      scope,
      branchId:
        scope === FinancialDashboardScope.ALL_BRANCHES
          ? query.branchId
          : (query.branchId ?? user.branchId ?? undefined),
    };
  }

  private assertAllBranches(user: AuthUser) {
    if (user.roleCode !== UserRole.OWNER && user.roleCode !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'No tienes permiso para ver todas las sucursales',
      );
    }
  }

  private async stockMap(
    companyId: string,
    branchId: string | undefined,
    productIds: string[],
  ) {
    if (!branchId || !productIds.length)
      return new Map<string, { quantity: Prisma.Decimal }>();
    const stocks = await this.prisma.productBranchStock.findMany({
      where: { companyId, branchId, productId: { in: productIds } },
      select: { productId: true, quantity: true },
    });
    return new Map(stocks.map((stock) => [stock.productId, stock]));
  }
}

function dateRange(query: FinancialDashboardQueryDto): Range {
  const to = parseDate(query.to, true);
  const from =
    query.from === undefined
      ? new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000)
      : parseDate(query.from, false);
  if (from > to) throw new BadRequestException('Rango de fechas invalido');
  return { from, to };
}

function parseDate(value: string | undefined, endOfDay: boolean) {
  if (!value) {
    const date = new Date();
    date.setHours(
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
  if (Number.isNaN(parsed.getTime()))
    throw new BadRequestException('Fecha invalida');
  return parsed;
}

function previousRange(range: Range): Range {
  const duration = range.to.getTime() - range.from.getTime();
  const previousTo = new Date(range.from.getTime() - 1);
  return { from: new Date(previousTo.getTime() - duration), to: previousTo };
}

function money(value: Prisma.Decimal | number | string) {
  return Number(new Prisma.Decimal(value).toFixed(2));
}

function safeDivide(value: number, divisor: number) {
  return divisor ? value / divisor : 0;
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return money(((current - previous) / previous) * 100);
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function paymentLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    CREDIT: 'Credito',
  };
  return labels[method];
}

function alert(
  type: string,
  severity: 'info' | 'warning' | 'danger' | 'success',
  title: string,
  description: string,
  count: number,
  actionUrl: string,
) {
  return { type, severity, title, description, count, actionUrl };
}
