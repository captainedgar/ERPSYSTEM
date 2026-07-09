import type {
  ElectronicDocumentType,
  ElectronicInvoiceStatus,
  Prisma,
} from '@prisma/client';

import type { MockFiscalOutcome } from '../dto/electronic-invoice.dto';

export interface FiscalProviderInvoiceInput {
  invoiceId: string;
  documentType: ElectronicDocumentType;
  payload: Prisma.JsonValue;
  mockOutcome?: MockFiscalOutcome;
}

export interface FiscalProviderResult {
  status: ElectronicInvoiceStatus;
  providerDocumentId: string | null;
  providerTrackId: string | null;
  fiscalNumber: string | null;
  response: Prisma.InputJsonValue;
  errorCode?: string;
  errorMessage?: string;
}

export interface FiscalProviderAdapter {
  sendInvoice(input: FiscalProviderInvoiceInput): Promise<FiscalProviderResult>;
  getStatus(input: FiscalProviderInvoiceInput): Promise<FiscalProviderResult>;
  cancelDocument(
    input: FiscalProviderInvoiceInput,
  ): Promise<FiscalProviderResult>;
  retry(input: FiscalProviderInvoiceInput): Promise<FiscalProviderResult>;
  testConnection(): Promise<Prisma.InputJsonValue>;
}
