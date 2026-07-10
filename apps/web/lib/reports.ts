import { apiRequest } from './api';

export interface ReportRange {
  from: string;
  to: string;
}

export interface OverviewReport {
  totalSales: number;
  salesCount: number;
  averageTicket: number;
  cashTotal: number;
  customersCount: number;
  lowStockCount: number;
  internalDocumentsCount: number;
  activeBranch: {
    id: string;
    code: string;
    name: string;
    isMain: boolean;
  } | null;
  dateRange: ReportRange;
}

export interface SalesReport {
  total: number;
  count: number;
  averageTicket: number;
  cancelledCount: number;
  paidAmount: number;
  balance: number;
  items: Array<{
    id: string;
    saleNumber: string;
    date: string;
    customer: { id: string; name: string } | null;
    user: { id: string; name: string };
    branch: { id: string; name: string; code: string };
    status: string;
    total: number;
    paid: number;
    balance: number;
  }>;
}

export interface CashReport {
  sessionsCount: number;
  openedSessions: number;
  closedSessions: number;
  openingTotal: number;
  cashSalesTotal: number;
  manualInTotal: number;
  manualOutTotal: number;
  expectedCashTotal: number;
  countedCashTotal: number;
  differenceTotal: number;
  sessions: Array<{
    id: string;
    status: string;
    branch: { id: string; code: string; name: string };
    openedBy: { id: string; name: string };
    closedBy: { id: string; name: string } | null;
    openingAmount: number;
    expectedCashAmount: number;
    countedCashAmount: number | null;
    differenceAmount: number | null;
    openedAt: string;
    closedAt: string | null;
  }>;
}

export interface CustomersReport {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  topCustomersBySales: Array<{
    customerId: string;
    customerName: string;
    salesCount: number;
    total: number;
  }>;
  recentCustomers: Array<{
    id: string;
    name: string;
    documentNumber: string | null;
    status: string;
    createdAt: string;
  }>;
}

export interface InventoryLowStockReport {
  items: Array<{
    productId: string;
    name: string;
    sku: string | null;
    currentStock: number;
    minStock: number;
    status: string;
  }>;
  scope: string;
}

export interface DocumentsReport {
  totalDocuments: number;
  documentsByStatus: Record<string, number>;
  documentsByType: Record<string, number>;
  recentDocuments: Array<{
    id: string;
    documentNumber: string;
    documentType: string;
    status: string;
    customer: { id: string; name: string } | null;
    branch: { id: string; code: string; name: string };
    total: number;
    createdAt: string;
  }>;
}

export interface ByDayReport {
  items: Array<{ date: string; salesCount: number; total: number }>;
}

export interface ByUserReport {
  items: Array<{
    userId: string;
    userName: string;
    salesCount: number;
    total: number;
  }>;
}

export interface TopProductsReport {
  items: Array<{
    productId: string;
    name: string;
    quantitySold: number;
    totalSold: number;
  }>;
}

export type ReportFilters = { from?: string; to?: string };

function query(filters: ReportFilters = {}) {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.size ? `?${params.toString()}` : '';
}

export const reportsApi = {
  overview: (filters?: ReportFilters) =>
    apiRequest<OverviewReport>(`/reports/overview${query(filters)}`),
  sales: (filters?: ReportFilters) =>
    apiRequest<SalesReport>(`/reports/sales${query(filters)}`),
  salesByDay: (filters?: ReportFilters) =>
    apiRequest<ByDayReport>(`/reports/sales/by-day${query(filters)}`),
  salesByUser: (filters?: ReportFilters) =>
    apiRequest<ByUserReport>(`/reports/sales/by-user${query(filters)}`),
  topProducts: (filters?: ReportFilters) =>
    apiRequest<TopProductsReport>(
      `/reports/sales/top-products${query(filters)}`,
    ),
  cash: (filters?: ReportFilters) =>
    apiRequest<CashReport>(`/reports/cash${query(filters)}`),
  customers: (filters?: ReportFilters) =>
    apiRequest<CustomersReport>(`/reports/customers${query(filters)}`),
  lowStock: () =>
    apiRequest<InventoryLowStockReport>('/reports/inventory/low-stock'),
  documents: (filters?: ReportFilters) =>
    apiRequest<DocumentsReport>(`/reports/documents${query(filters)}`),
};
