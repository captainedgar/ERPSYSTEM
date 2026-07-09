import {
  ElectronicDocumentType,
  ElectronicInvoiceStatus,
  FiscalEnvironment,
  FiscalProviderMode,
  FiscalProviderStatus,
} from '@comercia/shared';

import { apiRequest } from './api';

export type MockFiscalOutcome = 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'PENDING';

export interface FiscalSettings {
  id: string;
  companyId: string;
  rnc: string | null;
  legalName: string | null;
  commercialName: string | null;
  economicActivity: string | null;
  fiscalAddress: string | null;
  province: string | null;
  municipality: string | null;
  environment: FiscalEnvironment;
  providerMode: FiscalProviderMode;
  activeProviderId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalProvider {
  id: string;
  companyId: string;
  name: string;
  code: string;
  mode: FiscalProviderMode;
  status: FiscalProviderStatus;
  baseUrl: string | null;
  credentials?: Array<{ id: string; keyName: string; createdAt: string }>;
}

export interface ElectronicInvoice {
  id: string;
  companyId: string;
  branchId: string;
  saleId: string | null;
  internalDocumentId: string | null;
  customerId: string | null;
  documentType: ElectronicDocumentType;
  status: ElectronicInvoiceStatus;
  fiscalNumber: string | null;
  providerDocumentId: string | null;
  providerTrackId: string | null;
  payload: unknown;
  response: unknown;
  errorMessage: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sale?: { id: string; saleNumber: string; status: string } | null;
  internalDocument?: {
    id: string;
    documentNumber: string;
    documentType: string;
    status: string;
  } | null;
  customer?: { id: string; name: string; documentNumber: string | null } | null;
  createdBy?: { id: string; name: string; email: string };
}

export interface ElectronicInvoiceListResponse {
  items: ElectronicInvoice[];
  total: number;
  page: number;
  limit: number;
}

export interface ElectronicInvoiceEvent {
  id: string;
  eventType: string;
  message: string;
  payload: unknown;
  createdAt: string;
}

export interface FiscalError {
  id: string;
  code: string;
  message: string;
  details: unknown;
  resolved: boolean;
  createdAt: string;
}

export interface ElectronicInvoiceFilters {
  search?: string;
  status?: ElectronicInvoiceStatus;
  documentType?: ElectronicDocumentType;
  saleId?: string;
  internalDocumentId?: string;
  page?: number;
  limit?: number;
}

export function getFiscalSettings() {
  return apiRequest<FiscalSettings>('/fiscal/settings');
}

export function updateFiscalSettings(payload: Partial<FiscalSettings>) {
  return apiRequest<FiscalSettings>('/fiscal/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listFiscalProviders() {
  return apiRequest<FiscalProvider[]>('/fiscal/providers');
}

export function enableMockProvider() {
  return apiRequest<FiscalProvider>('/fiscal/providers/mock/enable', {
    method: 'POST',
  });
}

export function testFiscalProviderConnection(providerId: string) {
  return apiRequest<unknown>(
    `/fiscal/providers/${providerId}/test-connection`,
    {
      method: 'POST',
    },
  );
}

export function createElectronicInvoiceFromSale(
  saleId: string,
  documentType = ElectronicDocumentType.INTERNAL_TEST,
) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/from-sale/${saleId}`,
    { method: 'POST', body: JSON.stringify({ documentType }) },
  );
}

export function createElectronicInvoiceFromInternalDocument(
  internalDocumentId: string,
  documentType = ElectronicDocumentType.INTERNAL_TEST,
) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/from-internal-document/${internalDocumentId}`,
    { method: 'POST', body: JSON.stringify({ documentType }) },
  );
}

export function listElectronicInvoices(filters: ElectronicInvoiceFilters = {}) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.status) query.set('status', filters.status);
  if (filters.documentType) query.set('documentType', filters.documentType);
  if (filters.saleId) query.set('saleId', filters.saleId);
  if (filters.internalDocumentId) {
    query.set('internalDocumentId', filters.internalDocumentId);
  }
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<ElectronicInvoiceListResponse>(
    `/fiscal/electronic-invoices${suffix}`,
  );
}

export function getElectronicInvoice(id: string) {
  return apiRequest<ElectronicInvoice>(`/fiscal/electronic-invoices/${id}`);
}

export function sendElectronicInvoice(
  id: string,
  mockOutcome?: MockFiscalOutcome,
) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/${id}/send`,
    {
      method: 'POST',
      body: JSON.stringify({ mockOutcome }),
    },
  );
}

export function retryElectronicInvoice(
  id: string,
  mockOutcome?: MockFiscalOutcome,
) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/${id}/retry`,
    {
      method: 'POST',
      body: JSON.stringify({ mockOutcome }),
    },
  );
}

export function checkElectronicInvoiceStatus(id: string) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/${id}/status`,
  );
}

export function getElectronicInvoiceEvents(id: string) {
  return apiRequest<ElectronicInvoiceEvent[]>(
    `/fiscal/electronic-invoices/${id}/events`,
  );
}

export function getElectronicInvoiceErrors(id: string) {
  return apiRequest<FiscalError[]>(`/fiscal/electronic-invoices/${id}/errors`);
}

export {
  ElectronicDocumentType,
  ElectronicInvoiceStatus,
  FiscalEnvironment,
  FiscalProviderMode,
  FiscalProviderStatus,
};
