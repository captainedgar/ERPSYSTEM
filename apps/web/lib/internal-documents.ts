import {
  InternalDocumentStatus,
  InternalDocumentType,
  PaymentMethod,
  SaleItemType,
} from '@comercia/shared';

import { apiRequest } from './api';

export interface InternalDocumentItem {
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
}

export interface InternalDocument {
  id: string;
  companyId: string;
  branchId: string;
  saleId: string;
  customerId: string | null;
  documentNumber: string;
  documentType: InternalDocumentType;
  status: InternalDocumentStatus;
  subtotal: string | number;
  taxTotal: string | number;
  discountTotal: string | number;
  total: string | number;
  paidTotal: string | number;
  balanceDue: string | number;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    legalName: string | null;
    rncOrCedula: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    logoUrl: string | null;
    settings?: { printLogo: boolean } | null;
  };
  branch?: {
    id: string;
    code: string;
    name: string;
    phone?: string | null;
    address?: string | null;
  };
  customer: {
    id: string;
    name: string;
    documentType?: string;
    documentNumber: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  sale: {
    id: string;
    saleNumber: string;
    status: string;
    createdAt?: string;
    cashSessionId?: string | null;
    payments?: InternalDocumentPayment[];
  };
  createdBy: { id: string; name: string; email: string };
  voidedBy?: { id: string; name: string; email: string } | null;
  items?: InternalDocumentItem[];
}

export interface InternalDocumentPayment {
  id: string;
  method: PaymentMethod;
  amount: string | number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InternalDocumentListResponse {
  items: InternalDocument[];
  total: number;
  page: number;
  limit: number;
}

export interface InternalDocumentFilters {
  search?: string;
  documentType?: InternalDocumentType;
  status?: InternalDocumentStatus;
  customerId?: string;
  saleId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface InternalDocumentPrintData {
  company: NonNullable<InternalDocument['company']>;
  branch: NonNullable<InternalDocument['branch']>;
  customer: InternalDocument['customer'];
  document: {
    id: string;
    documentNumber: string;
    documentType: InternalDocumentType;
    status: InternalDocumentStatus;
    createdAt: string;
    notes: string | null;
    sale: InternalDocument['sale'];
  };
  items: InternalDocumentItem[];
  payments: InternalDocumentPayment[];
  totals: {
    subtotal: string | number;
    taxTotal: string | number;
    discountTotal: string | number;
    total: string | number;
    paidTotal: string | number;
    balanceDue: string | number;
  };
  disclaimer: string;
}

export function listInternalDocuments(filters: InternalDocumentFilters = {}) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.documentType) query.set('documentType', filters.documentType);
  if (filters.status) query.set('status', filters.status);
  if (filters.customerId) query.set('customerId', filters.customerId);
  if (filters.saleId) query.set('saleId', filters.saleId);
  if (filters.dateFrom) query.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.set('dateTo', filters.dateTo);
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<InternalDocumentListResponse>(
    `/internal-documents${suffix}`,
  );
}

export function createInternalDocumentFromSale(
  saleId: string,
  documentType: InternalDocumentType,
  notes?: string,
) {
  return apiRequest<InternalDocument>(
    `/internal-documents/from-sale/${saleId}`,
    {
      method: 'POST',
      body: JSON.stringify({ documentType, notes }),
    },
  );
}

export function getInternalDocument(id: string) {
  return apiRequest<InternalDocument>(`/internal-documents/${id}`);
}

export function getInternalDocumentPrintData(id: string) {
  return apiRequest<InternalDocumentPrintData>(
    `/internal-documents/${id}/print`,
  );
}

export function listSaleInternalDocuments(saleId: string) {
  return apiRequest<InternalDocument[]>(`/sales/${saleId}/internal-documents`);
}

export function voidInternalDocument(id: string, reason: string) {
  return apiRequest<InternalDocument>(`/internal-documents/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export { InternalDocumentStatus, InternalDocumentType };
