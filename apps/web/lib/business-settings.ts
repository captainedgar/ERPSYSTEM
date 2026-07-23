import {
  BusinessType,
  Currency,
  DocumentType,
  PaymentMethod,
} from '@comercia/shared';

import { apiRequest } from './api';

export interface BusinessSettings {
  id: string;
  companyId: string;
  businessType: BusinessType;
  currency: Currency;
  taxRate: string | number;
  allowNegativeStock: boolean;
  requireOpenCashForSales: boolean;
  defaultDocumentType: DocumentType;
  defaultPaymentMethod: PaymentMethod;
  enabledPaymentMethods: PaymentMethod[];
  receiptFooterText: string | null;
  printLogo: boolean;
  posQuickSaleMode: boolean;
  posShowStock: boolean;
  posAllowDiscounts: boolean;
  cashRequireOpeningAmount: boolean;
  cashAllowExpenses: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
}

export interface CompanyLogo {
  companyId: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  logoFileKey: string | null;
  logoUpdatedAt: string | null;
}

export interface BusinessTemplateDefinition {
  id: BusinessType;
  name: string;
  description: string;
  futureCapabilities: string[];
}

export type UpdateBusinessSettings = Omit<
  BusinessSettings,
  'id' | 'companyId' | 'onboardingCompleted' | 'onboardingCompletedAt'
>;

export function getBusinessSettings() {
  return apiRequest<BusinessSettings>('/business-settings');
}

export function updateBusinessSettings(settings: UpdateBusinessSettings) {
  return apiRequest<BusinessSettings>('/business-settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

export function getBusinessTemplates() {
  return apiRequest<BusinessTemplateDefinition[]>(
    '/business-settings/templates',
  );
}

export function applyBusinessTemplate(businessType: BusinessType) {
  return apiRequest<BusinessSettings>('/business-settings/apply-template', {
    method: 'POST',
    body: JSON.stringify({ businessType }),
  });
}

export function completeBusinessOnboarding() {
  return apiRequest<BusinessSettings>(
    '/business-settings/complete-onboarding',
    { method: 'POST' },
  );
}

export function getCompanyLogo() {
  return apiRequest<CompanyLogo>('/companies/me/logo');
}

export function uploadCompanyLogo(file: File) {
  const body = new FormData();
  body.set('logo', file);
  return apiRequest<CompanyLogo>('/companies/me/logo', {
    method: 'POST',
    body,
  });
}

export function deleteCompanyLogo() {
  return apiRequest<CompanyLogo>('/companies/me/logo', { method: 'DELETE' });
}

export { BusinessType, Currency, DocumentType, PaymentMethod };
