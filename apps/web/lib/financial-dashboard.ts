import { apiRequest } from './api';

export type FinancialDashboardScope = 'active_branch' | 'all_branches';

export interface FinancialDashboardFilters {
  from?: string;
  to?: string;
  scope?: FinancialDashboardScope;
  branchId?: string;
}

export interface FinancialDashboardSummary {
  grossSales: number;
  netSales: number;
  salesCount: number;
  cancelledSales: number;
  averageTicket: number;
  cashCollected: number;
  pendingBalance: number;
  discountTotal: number;
  taxTotal: number;
  estimatedCost: number;
  estimatedGrossProfit: number;
  estimatedGrossMargin: number;
  activeBranch: { id: string; name: string; code: string } | null;
  dateRange: { from: string; to: string };
  comparison: {
    previousGrossSales: number;
    grossSalesChangePercent: number;
    previousSalesCount: number;
    salesCountChangePercent: number;
    previousAverageTicket: number;
    averageTicketChangePercent: number;
  };
}

export interface FinancialDashboardTrend {
  items: Array<{
    date: string;
    salesCount: number;
    grossSales: number;
    netSales: number;
    cashCollected: number;
    averageTicket: number;
  }>;
  dateRange: { from: string; to: string };
}

export interface FinancialDashboardPaymentMethods {
  items: Array<{
    paymentMethod: string;
    label: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
}

export interface FinancialDashboardBranches {
  items: Array<{
    branchId: string;
    branchName: string;
    salesCount: number;
    grossSales: number;
    netSales: number;
    averageTicket: number;
    cashCollected: number;
    cancelledSales: number;
  }>;
}

export interface FinancialDashboardTopProducts {
  items: Array<{
    productId: string;
    name: string;
    sku: string | null;
    quantitySold: number;
    grossSales: number;
    estimatedCost: number;
    estimatedProfit: number;
    stockInActiveBranch: number;
  }>;
}

export interface FinancialDashboardTopCustomers {
  items: Array<{
    customerId: string;
    customerName: string;
    salesCount: number;
    totalPurchased: number;
    lastPurchaseAt: string;
    pendingBalance: number;
  }>;
}

export interface FinancialDashboardCashHealth {
  openSessions: number;
  closedSessions: number;
  expectedCash: number;
  countedCash: number;
  differenceTotal: number;
  manualIn: number;
  manualOut: number;
  cashSales: number;
  sessionsWithDifference: number;
  largestDifference: number;
}

export interface FinancialDashboardInventoryValue {
  totalProducts: number;
  productsWithStock: number;
  productsWithoutStock: number;
  lowStockProducts: number;
  inventoryCostValue: number;
  inventorySaleValue: number;
  estimatedPotentialMargin: number;
  stockByBranch: Array<{
    branchId: string;
    branchName: string;
    inventoryCostValue: number;
    inventorySaleValue: number;
    productsWithStock: number;
  }>;
}

export interface FinancialDashboardAlerts {
  items: Array<{
    type: string;
    severity: 'info' | 'warning' | 'danger' | 'success';
    title: string;
    description: string;
    count: number;
    actionUrl: string;
  }>;
}

export interface FinancialDashboardData {
  summary: FinancialDashboardSummary;
  trend: FinancialDashboardTrend;
  paymentMethods: FinancialDashboardPaymentMethods;
  branches: FinancialDashboardBranches | null;
  topProducts: FinancialDashboardTopProducts;
  topCustomers: FinancialDashboardTopCustomers;
  cashHealth: FinancialDashboardCashHealth;
  inventoryValue: FinancialDashboardInventoryValue;
  alerts: FinancialDashboardAlerts;
}

function query(filters: FinancialDashboardFilters) {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.branchId) params.set('branchId', filters.branchId);
  return params.size ? `?${params.toString()}` : '';
}

export const financialDashboardApi = {
  summary: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardSummary>(
      `/financial-dashboard/summary${query(filters)}`,
    ),
  salesTrend: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardTrend>(
      `/financial-dashboard/sales-trend${query(filters)}`,
    ),
  paymentMethods: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardPaymentMethods>(
      `/financial-dashboard/payment-methods${query(filters)}`,
    ),
  branches: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardBranches>(
      `/financial-dashboard/branches${query(filters)}`,
    ),
  topProducts: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardTopProducts>(
      `/financial-dashboard/top-products${query(filters)}`,
    ),
  topCustomers: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardTopCustomers>(
      `/financial-dashboard/top-customers${query(filters)}`,
    ),
  cashHealth: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardCashHealth>(
      `/financial-dashboard/cash-health${query(filters)}`,
    ),
  inventoryValue: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardInventoryValue>(
      `/financial-dashboard/inventory-value${query(filters)}`,
    ),
  alerts: (filters: FinancialDashboardFilters) =>
    apiRequest<FinancialDashboardAlerts>(
      `/financial-dashboard/alerts${query(filters)}`,
    ),
  all: async (filters: FinancialDashboardFilters) => {
    const [
      summary,
      trend,
      paymentMethods,
      branches,
      topProducts,
      topCustomers,
      cashHealth,
      inventoryValue,
      alerts,
    ] = await Promise.all([
      financialDashboardApi.summary(filters),
      financialDashboardApi.salesTrend(filters),
      financialDashboardApi.paymentMethods(filters),
      filters.scope === 'all_branches'
        ? financialDashboardApi
            .branches(filters)
            .catch((): FinancialDashboardBranches | null => null)
        : Promise.resolve(null),
      financialDashboardApi.topProducts(filters),
      financialDashboardApi.topCustomers(filters),
      financialDashboardApi.cashHealth(filters),
      financialDashboardApi.inventoryValue(filters),
      financialDashboardApi.alerts(filters),
    ]);
    return {
      summary,
      trend,
      paymentMethods,
      branches,
      topProducts,
      topCustomers,
      cashHealth,
      inventoryValue,
      alerts,
    };
  },
};
