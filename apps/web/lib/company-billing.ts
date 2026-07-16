import { apiRequest } from './api';

export type CompanyBillingStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAYMENT_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface CompanyBillingLink {
  id: string;
  token: string;
  status: string;
  amount: string | number;
  expiresAt?: string | null;
  reports: Array<{
    id: string;
    status: string;
    amount: string | number;
    reference?: string | null;
    reportedAt: string;
  }>;
}

export interface CompanyBillingSubscription {
  id: string;
  status: CompanyBillingStatus;
  startsAt: string;
  currentPeriodEnd: string;
  nextPaymentDueAt: string;
  graceEndsAt?: string | null;
  plan: {
    name: string;
    price: string | number;
    currency: string;
    billingInterval: 'MONTHLY' | 'YEARLY';
  };
  company: { id: string; name: string; status: string };
}

export interface CompanyBillingInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string | number;
  balance: string | number;
  issueDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  plan: { name: string };
  paymentLinks: CompanyBillingLink[];
}

export interface CompanyBillingPayment {
  id: string;
  amount: string | number;
  currency: string;
  method: string;
  reference?: string | null;
  paidAt: string;
  invoice?: { id: string; invoiceNumber: string; status: string } | null;
}

export interface CompanyBillingEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface CompanyPlanOption {
  code: 'BASIC' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';
  name: string;
  description: string;
  price: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  features: string[];
  customLimits: boolean;
}

export interface CompanyEntitlements {
  plan: {
    id: string;
    code: CompanyPlanOption['code'];
    name: string;
    price: string | number;
    billingInterval: string;
  };
  subscriptionStatus: CompanyBillingStatus;
  companyStatus: string;
  limits: {
    maxBranches: number | null;
    maxUsers: number | null;
    maxProducts: number | null;
  };
  usage: { branches: number; users: number; products: number };
  features: string[];
}

export function getMySubscription() {
  return apiRequest<CompanyBillingSubscription | null>(
    '/company-billing/subscription',
  );
}

export function getMyInvoices() {
  return apiRequest<CompanyBillingInvoice[]>('/company-billing/invoices');
}

export function getMyPayments() {
  return apiRequest<CompanyBillingPayment[]>('/company-billing/payments');
}

export function getMyBillingEvents() {
  return apiRequest<CompanyBillingEvent[]>('/company-billing/events');
}

export function getMyInvoicePaymentLink(invoiceId: string) {
  return apiRequest<CompanyBillingLink>(
    `/company-billing/invoices/${invoiceId}/payment-link`,
    { method: 'POST' },
  );
}

export function getMyEntitlements() {
  return apiRequest<CompanyEntitlements>('/company-billing/entitlements');
}

export function getAvailableCompanyPlans() {
  return apiRequest<CompanyPlanOption[]>('/company-billing/plans');
}

export function requestCompanyPlanChange(planCode: CompanyPlanOption['code']) {
  return apiRequest<{ success: true; message?: string }>(
    '/company-billing/plan-change-request',
    { method: 'POST', body: JSON.stringify({ planCode }) },
  );
}
