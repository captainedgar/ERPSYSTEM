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

export interface CompanyPlanChangeRequest {
  id: string;
  status:
    | 'PENDING'
    | 'APPROVED_PENDING_PAYMENT'
    | 'APPROVED_APPLIED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'PAYMENT_FAILED';
  currentPlanCode?: CompanyPlanOption['code'];
  currentPlanName?: string;
  requestedPlanCode?: CompanyPlanOption['code'];
  requestedPlanName?: string;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  currentPlan?: { id: string; name: string };
  requestedPlan?: { id: string; name: string };
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    balance: string | number;
  } | null;
  checkoutSession?: {
    id: string;
    status: string;
    checkoutUrl?: string | null;
  } | null;
}

export function createPlanChangeCheckout(id: string) {
  return apiRequest<{ id: string; checkoutUrl?: string | null }>(
    `/company-billing/plan-change-requests/${id}/checkout`,
    { method: 'POST' },
  );
}

export function capturePayPalCheckout(id: string) {
  return apiRequest<{ success: true; idempotent: boolean; message: string }>(
    `/company-billing/checkout-sessions/${encodeURIComponent(id)}/capture`,
    { method: 'POST' },
  );
}

export interface PaymentInstructions {
  methods: Array<{
    code: string;
    name: string;
    bank?: string;
    accountHolder?: string;
    taxId?: string;
    accountNumber?: string;
    currency?: string;
    instructions: string;
  }>;
  billingContact: { email: string; whatsapp: string };
  card: { available: false; label: string; notice: string };
}

export interface PaymentProviderStatus {
  onlinePaymentsEnabled: boolean;
  provider: 'PAYPAL';
  configured: boolean;
  environment: 'sandbox' | 'live';
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  webhookConfigured: boolean;
  appPublicUrlConfigured: boolean;
  apiPublicUrlConfigured: boolean;
  checkoutCurrency: string;
  dopUsdRate: number | null;
  currencySupported: boolean;
  message: string;
}

export function getPaymentProviderStatus() {
  return apiRequest<PaymentProviderStatus>(
    '/company-billing/payment-provider-status',
  );
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
  return apiRequest<{
    success: true;
    id?: string;
    status?: 'PENDING';
    message?: string;
  }>('/company-billing/plan-change-request', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  });
}

export function getMyPlanChangeRequests() {
  return apiRequest<CompanyPlanChangeRequest[]>(
    '/company-billing/plan-change-requests',
  );
}

export function getCompanyPaymentInstructions() {
  return apiRequest<PaymentInstructions>(
    '/company-billing/payment-instructions',
  );
}

export function cancelCompanyPlanChangeRequest(id: string) {
  return apiRequest<{
    id: string;
    status: 'CANCELLED';
    message: string;
    cancelledAt: string;
  }>(`/company-billing/plan-change-requests/${id}/cancel`, {
    method: 'POST',
  });
}
