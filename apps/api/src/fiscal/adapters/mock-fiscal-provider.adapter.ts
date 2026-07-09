import { Injectable } from '@nestjs/common';
import { ElectronicInvoiceStatus } from '@prisma/client';

import {
  type FiscalProviderAdapter,
  type FiscalProviderInvoiceInput,
  type FiscalProviderResult,
} from './fiscal-provider.adapter';

@Injectable()
export class MockFiscalProviderAdapter implements FiscalProviderAdapter {
  sendInvoice(
    input: FiscalProviderInvoiceInput,
  ): Promise<FiscalProviderResult> {
    return Promise.resolve(this.result(input, input.mockOutcome ?? 'ACCEPTED'));
  }

  getStatus(input: FiscalProviderInvoiceInput): Promise<FiscalProviderResult> {
    return Promise.resolve(this.result(input, 'ACCEPTED'));
  }

  cancelDocument(
    input: FiscalProviderInvoiceInput,
  ): Promise<FiscalProviderResult> {
    return Promise.resolve({
      status: ElectronicInvoiceStatus.CANCELLED,
      providerDocumentId: this.documentId(input.invoiceId),
      providerTrackId: this.trackId(input.invoiceId),
      fiscalNumber: null,
      response: {
        provider: 'MOCK',
        environment: 'SANDBOX',
        action: 'cancel',
        accepted: true,
      },
    });
  }

  async retry(
    input: FiscalProviderInvoiceInput,
  ): Promise<FiscalProviderResult> {
    return this.sendInvoice(input);
  }

  testConnection() {
    return Promise.resolve({
      provider: 'MOCK',
      environment: 'SANDBOX',
      reachable: true,
      message: 'Conexion mock disponible',
    });
  }

  private result(
    input: FiscalProviderInvoiceInput,
    outcome: 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'PENDING',
  ): FiscalProviderResult {
    const providerDocumentId = this.documentId(input.invoiceId);
    const providerTrackId = this.trackId(input.invoiceId);
    const fiscalNumber = `TEST-${input.documentType}-${input.invoiceId.slice(-8).toUpperCase()}`;
    if (outcome === 'FAILED') {
      return {
        status: ElectronicInvoiceStatus.FAILED,
        providerDocumentId,
        providerTrackId,
        fiscalNumber: null,
        response: {
          provider: 'MOCK',
          environment: 'SANDBOX',
          outcome,
          accepted: false,
        },
        errorCode: 'MOCK_PROVIDER_FAILED',
        errorMessage: 'El proveedor mock simulo un fallo de envio',
      };
    }
    if (outcome === 'REJECTED') {
      return {
        status: ElectronicInvoiceStatus.REJECTED,
        providerDocumentId,
        providerTrackId,
        fiscalNumber,
        response: {
          provider: 'MOCK',
          environment: 'SANDBOX',
          outcome,
          accepted: false,
        },
        errorCode: 'MOCK_REJECTED',
        errorMessage: 'El proveedor mock simulo un rechazo fiscal',
      };
    }
    if (outcome === 'PENDING') {
      return {
        status: ElectronicInvoiceStatus.PENDING_PROVIDER,
        providerDocumentId,
        providerTrackId,
        fiscalNumber,
        response: {
          provider: 'MOCK',
          environment: 'SANDBOX',
          outcome,
          accepted: null,
        },
      };
    }
    return {
      status: ElectronicInvoiceStatus.ACCEPTED,
      providerDocumentId,
      providerTrackId,
      fiscalNumber,
      response: {
        provider: 'MOCK',
        environment: 'SANDBOX',
        outcome,
        accepted: true,
      },
    };
  }

  private documentId(invoiceId: string) {
    return `mock-doc-${invoiceId.slice(-12)}`;
  }

  private trackId(invoiceId: string) {
    return `mock-track-${invoiceId.slice(-12)}`;
  }
}
