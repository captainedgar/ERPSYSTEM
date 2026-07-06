import {
  CustomerDocumentType,
  CustomerStatus,
  CustomerType,
  TaxpayerType,
} from '@comercia/shared';

import { apiRequest } from './api';

export interface Customer {
  id: string;
  companyId: string;
  type: CustomerType;
  name: string;
  commercialName: string | null;
  documentType: CustomerDocumentType;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  taxpayerType: TaxpayerType;
  paymentTermsDays: number;
  creditLimit: string | number;
  notes: string | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerFilters {
  search?: string;
  type?: CustomerType;
  documentType?: CustomerDocumentType;
  status?: CustomerStatus;
  page?: number;
  limit?: number;
}

export function listCustomers(filters: CustomerFilters = {}) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.type) query.set('type', filters.type);
  if (filters.documentType) {
    query.set('documentType', filters.documentType);
  }
  if (filters.status) query.set('status', filters.status);
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<CustomerListResponse>(`/customers${suffix}`);
}

export function getCustomer(id: string) {
  return apiRequest<Customer>(`/customers/${id}`);
}

export function createCustomer(payload: Record<string, unknown>) {
  return apiRequest<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(id: string, payload: Record<string, unknown>) {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateCustomerStatus(id: string, status: CustomerStatus) {
  return apiRequest<Customer>(`/customers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export { CustomerDocumentType, CustomerStatus, CustomerType, TaxpayerType };
