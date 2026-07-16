import { SaasBillingInterval } from '@prisma/client';

export const SAAS_PLAN_CODES = [
  'BASIC',
  'PRO',
  'PREMIUM',
  'ENTERPRISE',
] as const;
export type SaasPlanCode = (typeof SAAS_PLAN_CODES)[number];

export interface StandardPlanEntitlement {
  code: SaasPlanCode;
  name: string;
  description: string;
  price: number;
  billingInterval: SaasBillingInterval;
  graceDays: number;
  trialDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  features: string[];
  customLimits?: boolean;
}

export const STANDARD_SAAS_PLANS: Record<
  SaasPlanCode,
  StandardPlanEntitlement
> = {
  BASIC: {
    code: 'BASIC',
    name: 'Basico',
    description: 'Operacion esencial para negocios pequenos.',
    price: 1000,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 5,
    trialDays: 14,
    maxUsers: 3,
    maxBranches: 1,
    maxProducts: 500,
    features: [
      'pos',
      'sales',
      'cash',
      'customers',
      'inventory_basic',
      'reports_basic',
    ],
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    description: 'Gestion multi-sucursal para negocios en crecimiento.',
    price: 2500,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 7,
    trialDays: 14,
    maxUsers: 10,
    maxBranches: 3,
    maxProducts: 5000,
    features: [
      'pos',
      'sales',
      'cash',
      'customers',
      'inventory_basic',
      'reports_basic',
      'multi_branch',
      'inventory_transfers',
      'product_import',
      'data_export_basic',
      'financial_dashboard',
      'advanced_reports',
    ],
  },
  PREMIUM: {
    code: 'PREMIUM',
    name: 'Premium',
    description: 'Operacion avanzada para empresas multi-sucursal.',
    price: 5000,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 10,
    trialDays: 14,
    maxUsers: 30,
    maxBranches: 10,
    maxProducts: 20000,
    features: [
      'pos',
      'sales',
      'cash',
      'customers',
      'inventory_basic',
      'reports_basic',
      'multi_branch',
      'inventory_transfers',
      'product_import',
      'product_compatibility',
      'fiscal_mock',
      'data_export_basic',
      'data_export_full',
      'backup_xlsx',
      'financial_dashboard',
      'advanced_reports',
      'priority_support',
    ],
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Limites y configuracion comercial personalizada.',
    price: 0,
    billingInterval: SaasBillingInterval.MONTHLY,
    graceDays: 10,
    trialDays: 0,
    maxUsers: null,
    maxBranches: null,
    maxProducts: null,
    customLimits: true,
    features: [
      'pos',
      'sales',
      'cash',
      'customers',
      'inventory_basic',
      'reports_basic',
      'multi_branch',
      'inventory_transfers',
      'product_import',
      'product_compatibility',
      'fiscal_mock',
      'data_export_basic',
      'data_export_full',
      'backup_xlsx',
      'financial_dashboard',
      'advanced_reports',
      'priority_support',
    ],
  },
};

export function planModules(plan: StandardPlanEntitlement) {
  return {
    code: plan.code,
    maxProducts: plan.maxProducts,
    customLimits: plan.customLimits ?? false,
    ...Object.fromEntries(plan.features.map((feature) => [feature, true])),
  };
}

export function planCodeFromName(name: string): SaasPlanCode | null {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  return (
    SAAS_PLAN_CODES.find(
      (code) => STANDARD_SAAS_PLANS[code].name.toUpperCase() === normalized,
    ) ?? null
  );
}
