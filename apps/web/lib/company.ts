import { BusinessType } from '@comercia/shared';

import { apiRequest } from './api';

export interface CompanyBranding {
  companyId: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  logoFileKey: string | null;
  logoUpdatedAt: string | null;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legalName: string | null;
  businessType: BusinessType;
  logoUrl: string | null;
  logoFileKey: string | null;
  logoUpdatedAt: string | null;
}

export function getCompanyLogo() {
  return apiRequest<CompanyBranding>('/companies/me/logo');
}

export function uploadCompanyLogo(file: File) {
  const formData = new FormData();
  formData.set('logo', file);
  return apiRequest<CompanyBranding>('/companies/me/logo', {
    method: 'POST',
    body: formData,
  });
}

export function deleteCompanyLogo() {
  return apiRequest<CompanyBranding>('/companies/me/logo', {
    method: 'DELETE',
  });
}
