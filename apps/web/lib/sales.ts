import {
  PaymentMethod,
  PosItemType,
  SaleItemType,
  SaleStatus,
} from '@comercia/shared';

import { apiRequest } from './api';

export interface SaleItem {
  id: string;
  itemType: SaleItemType;
  productId: string | null;
  serviceId: string | null;
  name: string;
  description: string | null;
  quantity: string | number;
  unitPrice: string | number;
  taxRate: string | number;
  discountAmount: string | number;
  subtotal: string | number;
  taxTotal: string | number;
  total: string | number;
  affectsInventory: boolean;
}

export interface SalePayment {
  id: string;
  method: PaymentMethod;
  amount: string | number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

export interface Sale {
  id: string;
  companyId: string;
  branchId: string;
  customerId: string | null;
  cashSessionId: string | null;
  saleNumber: string;
  status: SaleStatus;
  subtotal: string | number;
  taxTotal: string | number;
  discountTotal: string | number;
  total: string | number;
  paidTotal: string | number;
  balanceDue: string | number;
  notes: string | null;
  createdById: string;
  cancelledById: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    documentType?: string;
    documentNumber: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  branch?: { id: string; code: string; name: string };
  createdBy: { id: string; name: string; email: string };
  cancelledBy?: { id: string; name: string; email: string } | null;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface SaleListResponse {
  items: Sale[];
  total: number;
  page: number;
  limit: number;
}

export interface SaleFilters {
  search?: string;
  status?: SaleStatus;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateSalePayload {
  customerId?: string;
  items: Array<{
    itemType: PosItemType;
    itemId: string;
    quantity: number;
    discountAmount: number;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }>;
  notes?: string;
}

export function listSales(filters: SaleFilters = {}) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.status) query.set('status', filters.status);
  if (filters.customerId) query.set('customerId', filters.customerId);
  if (filters.dateFrom) query.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.set('dateTo', filters.dateTo);
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<SaleListResponse>(`/sales${suffix}`);
}

export function getSale(id: string) {
  return apiRequest<Sale>(`/sales/${id}`);
}

export function createSale(payload: CreateSalePayload) {
  return apiRequest<Sale>('/sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function cancelSale(id: string, reason: string) {
  return apiRequest<Sale>(`/sales/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export { PaymentMethod, SaleItemType, SaleStatus };
