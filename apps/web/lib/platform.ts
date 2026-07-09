import { ApiError } from './api';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  'http://localhost:3001';
const TOKEN_KEY = 'comercia.platform.accessToken';

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN' | 'AUDITOR';
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface PlatformCompany {
  id: string;
  name: string;
  legalName: string | null;
  rncOrCedula: string | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
  businessType: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  _count?: { users: number; branches: number; sales: number };
  settings?: {
    currency: string;
    onboardingCompleted: boolean;
    defaultDocumentType: string;
  } | null;
  fiscalSettings?: {
    enabled: boolean;
    environment: string;
    providerMode: string;
  } | null;
}

export interface PlatformMetrics {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  totalSalesAmount: string | number;
  totalSales: number;
  internalDocuments: number;
  electronicInvoices: number;
  fiscalErrors: number;
}

export interface PlatformCompanyMetrics {
  companyId: string;
  users: number;
  branches: number;
  products: number;
  customers: number;
  totalSalesAmount: string | number;
  totalSales: number;
  internalDocuments: number;
  electronicInvoices: number;
  fiscalErrors: number;
}

export interface PlatformAuditLog {
  id: string;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  description: string;
  createdAt: string;
  platformUser: Pick<PlatformUser, 'id' | 'name' | 'email' | 'role'> | null;
}

export interface PlatformCompanyUser {
  id: string;
  companyId: string;
  branchId: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string } | null;
}

export type SaasBillingInterval = 'MONTHLY' | 'YEARLY';
export type CompanySubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAYMENT_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';
export type SubscriptionPaymentMethod =
  'CASH' | 'BANK_TRANSFER' | 'CARD_MANUAL' | 'CHECK' | 'OTHER';

export interface SaasPlan {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  currency: string;
  billingInterval: SaasBillingInterval;
  graceDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  modules: Record<string, boolean>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { subscriptions: number };
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  planId: string;
  status: CompanySubscriptionStatus;
  startsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextPaymentDueAt: string;
  graceDays: number;
  graceEndsAt: string | null;
  scheduledSuspensionAt: string | null;
  lastPaymentAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SaasPlan;
  company?: Pick<PlatformCompany, 'id' | 'name' | 'status'>;
}

export interface SubscriptionPayment {
  id: string;
  companyId: string;
  companySubscriptionId: string;
  amount: string | number;
  currency: string;
  method: SubscriptionPaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  company?: Pick<PlatformCompany, 'id' | 'name' | 'status'>;
  subscription?: CompanySubscription;
  createdByPlatformUser?: Pick<
    PlatformUser,
    'id' | 'name' | 'email' | 'role'
  > | null;
}

export interface SubscriptionEvent {
  id: string;
  companyId: string;
  companySubscriptionId: string;
  type: string;
  message: string;
  createdAt: string;
  createdByPlatformUser?: Pick<
    PlatformUser,
    'id' | 'name' | 'email' | 'role'
  > | null;
}

export function storePlatformToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPlatformToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getPlatformToken() {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

export async function platformRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getPlatformToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new ApiError(
      message ?? 'No se pudo completar la solicitud',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export function platformLogin(email: string, password: string) {
  return platformRequest<{ accessToken: string; user: PlatformUser }>(
    '/platform/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
  );
}

export function platformLogout() {
  return platformRequest<{ success: boolean }>('/platform/auth/logout', {
    method: 'POST',
  });
}

export function getPlatformMe() {
  return platformRequest<PlatformUser>('/platform/auth/me');
}

export function getPlatformMetrics() {
  return platformRequest<PlatformMetrics>('/platform/metrics');
}

export function listPlatformCompanies() {
  return platformRequest<PlatformCompany[]>('/platform/companies');
}

export function getPlatformCompany(id: string) {
  return platformRequest<PlatformCompany>(`/platform/companies/${id}`);
}

export function getPlatformCompanyUsers(id: string) {
  return platformRequest<PlatformCompanyUser[]>(
    `/platform/companies/${id}/users`,
  );
}

export function getPlatformCompanyMetrics(id: string) {
  return platformRequest<PlatformCompanyMetrics>(
    `/platform/companies/${id}/metrics`,
  );
}

export function updatePlatformCompanyStatus(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED',
) {
  return platformRequest<PlatformCompany>(`/platform/companies/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function listPlatformAuditLogs() {
  return platformRequest<PlatformAuditLog[]>('/platform/audit-logs');
}

export function listSaasPlans() {
  return platformRequest<SaasPlan[]>('/platform/plans');
}

export function createSaasPlan(body: Partial<SaasPlan>) {
  return platformRequest<SaasPlan>('/platform/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getSaasPlan(id: string) {
  return platformRequest<SaasPlan>(`/platform/plans/${id}`);
}

export function updateSaasPlan(id: string, body: Partial<SaasPlan>) {
  return platformRequest<SaasPlan>(`/platform/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function updateSaasPlanStatus(id: string, isActive: boolean) {
  return platformRequest<SaasPlan>(`/platform/plans/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function getCompanySubscription(companyId: string) {
  return platformRequest<CompanySubscription | null>(
    `/platform/companies/${companyId}/subscription`,
  );
}

export function upsertCompanySubscription(
  companyId: string,
  body: {
    planId: string;
    status?: CompanySubscriptionStatus;
    startsAt?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    nextPaymentDueAt?: string;
    graceDays?: number;
  },
) {
  return platformRequest<CompanySubscription>(
    `/platform/companies/${companyId}/subscription`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}

export function registerSubscriptionPayment(
  companyId: string,
  body: {
    amount: number;
    currency: string;
    method: SubscriptionPaymentMethod;
    reference?: string;
    notes?: string;
    paidAt: string;
    nextPaymentDueAt?: string;
  },
) {
  return platformRequest<{
    payment: SubscriptionPayment;
    subscription: CompanySubscription;
  }>(`/platform/companies/${companyId}/subscription/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listSubscriptionPayments(companyId: string) {
  return platformRequest<SubscriptionPayment[]>(
    `/platform/companies/${companyId}/subscription/payments`,
  );
}

export function listSubscriptionEvents(companyId: string) {
  return platformRequest<SubscriptionEvent[]>(
    `/platform/companies/${companyId}/subscription/events`,
  );
}

export function listBillingPayments() {
  return platformRequest<SubscriptionPayment[]>('/platform/billing/payments');
}

export function listBillingSubscriptions() {
  return platformRequest<CompanySubscription[]>(
    '/platform/billing/subscriptions',
  );
}
