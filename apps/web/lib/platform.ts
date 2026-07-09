const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  'http://localhost:3001';

const PLATFORM_TOKEN_KEY = 'comercia.platformAccessToken';

export type PlatformRole =
  'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN' | 'AUDITOR';

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PlatformAuthResponse {
  accessToken: string;
  user: PlatformUser;
}

export interface PlatformCompany {
  id: string;
  name: string;
  legalName?: string | null;
  rncOrCedula?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  businessType: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  _count?: { users?: number; branches?: number; sales?: number };
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

export interface PlatformAuditLog {
  id: string;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  description: string;
  metadataJson?: unknown;
  createdAt: string;
  platformUser?: Pick<PlatformUser, 'id' | 'name' | 'email' | 'role'> | null;
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
  description?: string | null;
  price: string | number;
  currency: 'DOP';
  billingInterval: SaasBillingInterval;
  graceDays: number;
  maxUsers?: number | null;
  maxBranches?: number | null;
  modules: Record<string, boolean>;
  isActive: boolean;
  _count?: { subscriptions?: number };
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
  graceEndsAt?: string | null;
  scheduledSuspensionAt?: string | null;
  suspendedAt?: string | null;
  lastPaymentAt?: string | null;
  plan: SaasPlan;
  company?: Pick<PlatformCompany, 'id' | 'name' | 'status'>;
}

export interface SubscriptionPayment {
  id: string;
  companyId: string;
  amount: string | number;
  currency: 'DOP';
  method: SubscriptionPaymentMethod;
  reference?: string | null;
  notes?: string | null;
  paidAt: string;
  company?: Pick<PlatformCompany, 'id' | 'name' | 'status'>;
}

export interface SubscriptionEvent {
  id: string;
  type: string;
  message: string;
  metadata?: unknown;
  createdAt: string;
}

export interface BillingOverdueProcessResult {
  movedToGracePeriod: number;
  companiesSuspended: number;
  noActionRequired: number;
}

export function storePlatformToken(token: string) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function getPlatformToken() {
  return typeof window === 'undefined'
    ? null
    : localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function clearPlatformToken() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
}

export function platformLogin(email: string, password: string) {
  return platformRequest<PlatformAuthResponse>(
    '/platform/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  );
}

export function platformLogout() {
  return platformRequest<{ success: true }>('/platform/auth/logout', {
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

export function listPlatformAuditLogs() {
  return platformRequest<PlatformAuditLog[]>('/platform/audit-logs');
}

export function getPlatformCompany(companyId: string) {
  return platformRequest<PlatformCompany>(`/platform/companies/${companyId}`);
}

export function listSaasPlans() {
  return platformRequest<SaasPlan[]>('/platform/plans');
}

export function listBillingSubscriptions() {
  return platformRequest<CompanySubscription[]>(
    '/platform/billing/subscriptions',
  );
}

export function listBillingPayments() {
  return platformRequest<SubscriptionPayment[]>('/platform/billing/payments');
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
    nextPaymentDueAt?: string;
    graceDays?: number;
  },
) {
  return platformRequest<CompanySubscription>(
    `/platform/companies/${companyId}/subscription`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export function registerSubscriptionPayment(
  companyId: string,
  body: {
    amount: number;
    currency: 'DOP';
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

export function processOverdueBilling() {
  return platformRequest<BillingOverdueProcessResult>(
    '/platform/billing/process-overdue',
    { method: 'POST' },
  );
}

async function platformRequest<T>(
  path: string,
  init: RequestInit = {},
  includeAuth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = includeAuth ? getPlatformToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(message ?? 'No se pudo completar la solicitud');
  }
  return response.json() as Promise<T>;
}
