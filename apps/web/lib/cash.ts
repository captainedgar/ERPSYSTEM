import {
  CashMovementType,
  CashSessionStatus,
  SaleStatus,
} from '@comercia/shared';

import { apiRequest } from './api';

export interface CashMovement {
  id: string;
  companyId: string;
  branchId: string;
  cashSessionId: string;
  type: CashMovementType;
  amount: string | number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  saleId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  sale: {
    id: string;
    saleNumber: string;
    status: SaleStatus;
  } | null;
}

export interface CashSession {
  id: string;
  companyId: string;
  branchId: string;
  openedById: string;
  closedById: string | null;
  status: CashSessionStatus;
  openingAmount: string | number;
  expectedCashAmount: string | number;
  countedCashAmount: string | number | null;
  differenceAmount: string | number | null;
  salesCashTotal: string | number;
  manualInTotal: string | number;
  manualOutTotal: string | number;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; code: string; name: string };
  openedBy: { id: string; name: string; email: string };
  closedBy: { id: string; name: string; email: string } | null;
  movements?: CashMovement[];
  sales?: Array<{
    id: string;
    saleNumber: string;
    status: SaleStatus;
    total: string | number;
    createdAt: string;
  }>;
}

export interface CashSessionListResponse {
  items: CashSession[];
  total: number;
  page: number;
  limit: number;
}

export interface CashSessionFilters {
  status?: CashSessionStatus;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function getCurrentCashSession() {
  const response = await apiRequest<{ session: CashSession | null }>(
    '/cash/current',
  );
  return response.session;
}

export function listCashSessions(filters: CashSessionFilters = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.branchId) query.set('branchId', filters.branchId);
  if (filters.dateFrom) query.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.set('dateTo', filters.dateTo);
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<CashSessionListResponse>(`/cash/sessions${suffix}`);
}

export function getCashSession(id: string) {
  return apiRequest<CashSession>(`/cash/sessions/${id}`);
}

export function openCashSession(payload: {
  branchId: string;
  openingAmount: number;
  notes?: string;
}) {
  return apiRequest<CashSession>('/cash/open', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function closeCashSession(payload: {
  cashSessionId: string;
  countedCashAmount: number;
  notes?: string;
}) {
  return apiRequest<CashSession>('/cash/close', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createManualCashIn(payload: {
  cashSessionId: string;
  amount: number;
  reason: string;
}) {
  return apiRequest<CashSession>('/cash/movements/manual-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createManualCashOut(payload: {
  cashSessionId: string;
  amount: number;
  reason: string;
}) {
  return apiRequest<CashSession>('/cash/movements/manual-out', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export { CashMovementType, CashSessionStatus };
