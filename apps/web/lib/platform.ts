import { getResponseMessage, parseJsonSafe } from './api';

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

export interface PlatformCompanyUser {
  id: string;
  name: string;
  email: string;
  status: string;
  role: { id: string; code: string; name: string };
  branch?: { id: string; code: string; name: string } | null;
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
export type SubscriptionInvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'VOIDED'
  | 'CANCELLED';
export type SubscriptionPaymentLinkStatus =
  'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAID';
export type SubscriptionPaymentReportStatus =
  'REPORTED' | 'REVIEWED' | 'DISCARDED';

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
  modules: Record<string, boolean | number | string | null>;
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

export interface SubscriptionInvoice {
  id: string;
  companyId: string;
  companySubscriptionId: string;
  planId: string;
  invoiceNumber: string;
  status: SubscriptionInvoiceStatus;
  currency: 'DOP';
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount: string | number;
  total: string | number;
  amountPaid: string | number;
  balance: string | number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  paidAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  notes?: string | null;
  company?: Pick<PlatformCompany, 'id' | 'name' | 'status' | 'email'>;
  plan: SaasPlan;
  payments?: SubscriptionPayment[];
}

export interface SubscriptionPayment {
  id: string;
  companyId: string;
  subscriptionInvoiceId?: string | null;
  amount: string | number;
  currency: 'DOP';
  method: SubscriptionPaymentMethod;
  reference?: string | null;
  notes?: string | null;
  paidAt: string;
  company?: Pick<PlatformCompany, 'id' | 'name' | 'status'>;
  invoice?: Pick<SubscriptionInvoice, 'id' | 'invoiceNumber' | 'status'> | null;
}

export interface SubscriptionPaymentReport {
  id: string;
  status: SubscriptionPaymentReportStatus;
  amount: string | number;
  currency: 'DOP';
  payerName?: string | null;
  payerEmail?: string | null;
  reference?: string | null;
  notes?: string | null;
  reportedAt: string;
  createdAt: string;
}

export interface SubscriptionPaymentLink {
  id: string;
  token: string;
  status: SubscriptionPaymentLinkStatus;
  amount: string | number;
  currency: 'DOP';
  expiresAt?: string | null;
  createdAt: string;
  invoice: SubscriptionInvoice;
  reports?: SubscriptionPaymentReport[];
}

export interface PublicSubscriptionPaymentLink {
  token: string;
  status: SubscriptionPaymentLinkStatus;
  amount: string | number;
  currency: 'DOP';
  expiresAt?: string | null;
  invoice: Pick<
    SubscriptionInvoice,
    | 'invoiceNumber'
    | 'status'
    | 'subtotal'
    | 'taxAmount'
    | 'discountAmount'
    | 'total'
    | 'amountPaid'
    | 'balance'
    | 'billingPeriodStart'
    | 'billingPeriodEnd'
    | 'issueDate'
    | 'dueDate'
    | 'notes'
  > & {
    company: { name: string; email?: string | null };
    plan: { name: string };
  };
  reports: Array<
    Pick<
      SubscriptionPaymentReport,
      'id' | 'status' | 'amount' | 'currency' | 'reference' | 'reportedAt'
    >
  >;
}

export interface SubscriptionEvent {
  id: string;
  type: string;
  message: string;
  metadata?: unknown;
  createdAt: string;
}

export interface BillingOverdueProcessResult {
  success?: true;
  movedToGrace?: number;
  movedToGracePeriod: number;
  companiesSuspended: number;
  invoicesOverdue?: number;
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

export const getPlatformCompanies = listPlatformCompanies;

export function listPlatformAuditLogs() {
  return platformRequest<PlatformAuditLog[]>('/platform/audit-logs');
}

export function getPlatformCompany(companyId: string) {
  return platformRequest<PlatformCompany>(`/platform/companies/${companyId}`);
}

export function getPlatformCompanyUsers(companyId: string) {
  return platformRequest<PlatformCompanyUser[]>(
    `/platform/companies/${companyId}/users`,
  );
}

export function getPlatformCompanyMetrics(companyId: string) {
  return platformRequest<PlatformCompanyMetrics>(
    `/platform/companies/${companyId}/metrics`,
  );
}

export function updatePlatformCompanyStatus(
  companyId: string,
  status: 'ACTIVE' | 'SUSPENDED',
) {
  return platformRequest<PlatformCompany>(
    `/platform/companies/${companyId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
}

export function listSaasPlans() {
  return platformRequest<SaasPlan[]>('/platform/plans');
}

export const getPlatformPlans = listSaasPlans;

export function getSaasPlan(planId: string) {
  return platformRequest<SaasPlan>(`/platform/plans/${planId}`);
}

export const getPlatformPlan = getSaasPlan;

export function createSaasPlan(body: {
  name: string;
  description?: string;
  price: number;
  currency: 'DOP';
  billingInterval: SaasBillingInterval;
  graceDays: number;
  maxUsers?: number;
  maxBranches?: number;
  modules: Record<string, boolean | number | string | null>;
}) {
  return platformRequest<SaasPlan>('/platform/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const createPlatformPlan = createSaasPlan;

export function updateSaasPlan(
  planId: string,
  body: Partial<{
    name: string;
    description: string;
    price: number;
    currency: 'DOP';
    billingInterval: SaasBillingInterval;
    graceDays: number;
    maxUsers: number | null;
    maxBranches: number | null;
    modules: Record<string, boolean | number | string | null>;
  }>,
) {
  return platformRequest<SaasPlan>(`/platform/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export const updatePlatformPlan = updateSaasPlan;

export function updateSaasPlanStatus(planId: string, isActive: boolean) {
  return platformRequest<SaasPlan>(`/platform/plans/${planId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export const updatePlatformPlanStatus = updateSaasPlanStatus;

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
    startsAt?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    nextPaymentDueAt?: string;
    graceDays?: number;
  },
) {
  return platformRequest<CompanySubscription>(
    `/platform/companies/${companyId}/subscription`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export const updateCompanySubscription = upsertCompanySubscription;

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
    subscriptionInvoiceId?: string;
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

export const registerCompanySubscriptionPayment = registerSubscriptionPayment;

export function listSubscriptionPayments(companyId: string) {
  return platformRequest<SubscriptionPayment[]>(
    `/platform/companies/${companyId}/subscription/payments`,
  );
}

export const getCompanySubscriptionPayments = listSubscriptionPayments;

export function listSubscriptionEvents(companyId: string) {
  return platformRequest<SubscriptionEvent[]>(
    `/platform/companies/${companyId}/subscription/events`,
  );
}

export const getCompanySubscriptionEvents = listSubscriptionEvents;

export async function getPlatformBilling() {
  const [subscriptions, payments, companies, invoices] = await Promise.all([
    listBillingSubscriptions(),
    listBillingPayments(),
    listPlatformCompanies(),
    listSubscriptionInvoices(),
  ]);
  return { companies, invoices, payments, subscriptions };
}

export function listSubscriptionInvoices() {
  return platformRequest<SubscriptionInvoice[]>('/platform/billing/invoices');
}

export function getSubscriptionInvoice(invoiceId: string) {
  return platformRequest<SubscriptionInvoice>(
    `/platform/billing/invoices/${invoiceId}`,
  );
}

export function listSubscriptionPaymentLinks(invoiceId: string) {
  return platformRequest<SubscriptionPaymentLink[]>(
    `/platform/billing/invoices/${invoiceId}/payment-links`,
  );
}

export function createSubscriptionPaymentLink(
  invoiceId: string,
  body: { expiresAt?: string; metadata?: Record<string, unknown> } = {},
) {
  return platformRequest<SubscriptionPaymentLink>(
    `/platform/billing/invoices/${invoiceId}/payment-links`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function cancelSubscriptionPaymentLink(id: string, reason?: string) {
  return platformRequest<SubscriptionPaymentLink>(
    `/platform/billing/payment-links/${id}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export function getPublicSubscriptionPaymentLink(token: string) {
  return publicPlatformRequest<PublicSubscriptionPaymentLink>(
    `/pay/invoice/${token}`,
  );
}

export function reportPublicSubscriptionPayment(
  token: string,
  body: {
    amount: number;
    payerName?: string;
    payerEmail?: string;
    reference?: string;
    notes?: string;
  },
) {
  return publicPlatformRequest<{
    report: SubscriptionPaymentReport;
    link: PublicSubscriptionPaymentLink;
  }>(`/pay/invoice/${token}/report`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function createSubscriptionInvoice(body: {
  companyId: string;
  companySubscriptionId?: string;
  planId?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total?: number;
  notes?: string;
}) {
  return platformRequest<SubscriptionInvoice>('/platform/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function voidSubscriptionInvoice(invoiceId: string, voidReason: string) {
  return platformRequest<SubscriptionInvoice>(
    `/platform/billing/invoices/${invoiceId}/void`,
    {
      method: 'POST',
      body: JSON.stringify({ voidReason }),
    },
  );
}

export function markSubscriptionInvoiceOverdue(invoiceId: string) {
  return platformRequest<SubscriptionInvoice>(
    `/platform/billing/invoices/${invoiceId}/mark-overdue`,
    { method: 'POST' },
  );
}

export function listCompanySubscriptionInvoices(companyId: string) {
  return platformRequest<SubscriptionInvoice[]>(
    `/platform/companies/${companyId}/subscription/invoices`,
  );
}

export function processOverdueBilling() {
  return platformRequest<BillingOverdueProcessResult>(
    '/platform/billing/process-overdue',
    { method: 'POST' },
  );
}

export function platformMoney(value: string | number | undefined) {
  return new Intl.NumberFormat('es-DO', {
    currency: 'DOP',
    style: 'currency',
  }).format(Number(value ?? 0));
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
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const message = getResponseMessage(data);
    throw new Error(message ?? 'No se pudo completar la solicitud');
  }
  return data as T;
}

async function publicPlatformRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const message = getResponseMessage(data);
    throw new Error(message ?? 'No se pudo completar la solicitud');
  }
  return data as T;
}
