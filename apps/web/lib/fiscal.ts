import { apiRequest } from './api';

export type FiscalEnvironment = 'SANDBOX' | 'PRODUCTION';
export type FiscalProviderMode = 'MOCK' | 'PROVIDER';
export type FiscalProviderStatus = 'ACTIVE' | 'INACTIVE';
export type ElectronicInvoiceStatus =
  | 'DRAFT'
  | 'PENDING_PROVIDER'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';
export type ElectronicDocumentType =
  | 'E31'
  | 'E32'
  | 'E33'
  | 'E34'
  | 'E41'
  | 'E43'
  | 'E44'
  | 'E45'
  | 'INTERNAL_TEST';
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
}

export interface FiscalProvider {
  id: string;
  name: string;
  code: string;
  mode: FiscalProviderMode;
  status: FiscalProviderStatus;
  baseUrl: string | null;
  credentials: Array<{ id: string; keyName: string; createdAt: string }>;
}

export interface ElectronicInvoice {
  id: string;
  branchId: string;
  saleId: string | null;
  internalDocumentId: string | null;
  customerId: string | null;
  documentType: ElectronicDocumentType;
  status: ElectronicInvoiceStatus;
  fiscalNumber: string | null;
  providerDocumentId: string | null;
  providerTrackId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sale: { id: string; saleNumber: string; status: string } | null;
  internalDocument: {
    id: string;
    documentNumber: string;
    documentType: string;
    status: string;
  } | null;
  customer: { id: string; name: string; documentNumber: string | null } | null;
  createdBy: { id: string; name: string; email: string };
}

export interface ElectronicInvoicesResponse {
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

export function enableMockFiscalProvider() {
  return apiRequest<FiscalProvider>('/fiscal/providers/mock/enable', {
    method: 'POST',
  });
}

export function testFiscalProvider(providerId: string) {
  return apiRequest<{ ok: boolean; message: string }>(
    `/fiscal/providers/${providerId}/test-connection`,
    { method: 'POST' },
  );
}

export function listElectronicInvoices(params: URLSearchParams) {
  const query = params.toString();
  return apiRequest<ElectronicInvoicesResponse>(
    `/fiscal/electronic-invoices${query ? `?${query}` : ''}`,
  );
}

export function getElectronicInvoice(id: string) {
  return apiRequest<ElectronicInvoice>(`/fiscal/electronic-invoices/${id}`);
}

export function createElectronicInvoiceFromSale(saleId: string) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/from-sale/${saleId}`,
    {
      method: 'POST',
      body: JSON.stringify({ documentType: 'INTERNAL_TEST' }),
    },
  );
}

export function createElectronicInvoiceFromInternalDocument(
  internalDocumentId: string,
) {
  return apiRequest<ElectronicInvoice>(
    `/fiscal/electronic-invoices/from-internal-document/${internalDocumentId}`,
    {
      method: 'POST',
      body: JSON.stringify({ documentType: 'INTERNAL_TEST' }),
    },
  );
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

export function listElectronicInvoiceEvents(id: string) {
  return apiRequest<ElectronicInvoiceEvent[]>(
    `/fiscal/electronic-invoices/${id}/events`,
  );
}

export function listElectronicInvoiceErrors(id: string) {
  return apiRequest<FiscalError[]>(`/fiscal/electronic-invoices/${id}/errors`);
}
