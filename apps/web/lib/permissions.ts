import type { AuthUser } from '@/components/auth-provider';

type UserWithPermissions = AuthUser & {
  permissions?: string[];
};

type RoleCode =
  'OWNER' | 'ADMIN' | 'CASHIER' | 'SELLER' | 'WAREHOUSE' | 'ACCOUNTING';

const fallbackPermissions: Partial<Record<RoleCode, string[]>> = {
  CASHIER: [
    'branches.view',
    'products.view',
    'services.view',
    'customers.view',
    'customers.create',
    'pos.access',
    'pos.validate_cart',
    'sales.view',
    'sales.create',
    'sales.view_detail',
    'internal_documents.view',
    'internal_documents.create',
    'internal_documents.print',
    'fiscal.documents.view',
    'cash.view',
    'cash.open',
    'cash.close',
    'cash.manual_movement',
    'cash.view_sessions',
    'reports.view',
    'reports.sales',
    'reports.cash',
    'data_export.view',
    'data_export.sales',
    'data_export.cash',
    'financial_dashboard.view',
    'financial_dashboard.sales',
    'financial_dashboard.cash',
  ],
  SELLER: [
    'branches.view',
    'products.view',
    'services.view',
    'customers.view',
    'customers.create',
    'pos.access',
    'pos.validate_cart',
    'sales.view',
    'sales.create',
    'sales.view_detail',
    'internal_documents.view',
    'internal_documents.create',
    'internal_documents.print',
    'cash.view',
    'reports.view',
    'reports.sales',
    'data_export.view',
    'data_export.sales',
    'financial_dashboard.view',
    'financial_dashboard.sales',
  ],
  WAREHOUSE: [
    'branches.view',
    'categories.view',
    'categories.create',
    'categories.update',
    'brands.view',
    'brands.create',
    'brands.update',
    'units.view',
    'units.create',
    'units.update',
    'products.view',
    'products.create',
    'products.update',
    'products.import',
    'product_compatibility.view',
    'product_compatibility.manage',
    'inventory.view',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.view_movements',
    'inventory.view_low_stock',
    'reports.view',
    'reports.inventory',
    'data_export.view',
    'data_export.products',
    'data_export.inventory',
    'financial_dashboard.view',
    'financial_dashboard.inventory',
  ],
  ACCOUNTING: [
    'companies.view',
    'branches.view',
    'products.view',
    'services.view',
    'inventory.view',
    'inventory.view_movements',
    'inventory.view_low_stock',
    'customers.view',
    'customers.update',
    'sales.view',
    'sales.view_detail',
    'internal_documents.view',
    'internal_documents.print',
    'internal_documents.void',
    'fiscal.settings.view',
    'fiscal.settings.update',
    'fiscal.providers.view',
    'fiscal.providers.configure',
    'fiscal.documents.view',
    'fiscal.documents.create',
    'fiscal.documents.send',
    'fiscal.documents.retry',
    'fiscal.documents.view_events',
    'fiscal.documents.view_errors',
    'cash.view',
    'cash.view_sessions',
    'reports.view',
    'reports.sales',
    'reports.cash',
    'reports.documents',
    'reports.customers',
    'data_export.view',
    'data_export.customers',
    'data_export.sales',
    'data_export.cash',
    'data_export.documents',
    'data_export.full_backup',
    'financial_dashboard.view',
    'financial_dashboard.sales',
    'financial_dashboard.cash',
    'financial_dashboard.customers',
  ],
};

export function hasRole(user: AuthUser | null | undefined, roles: string[]) {
  return Boolean(user && roles.includes(user.role.code));
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: string,
) {
  if (!user) return false;
  const typedUser = user as UserWithPermissions;
  if (Array.isArray(typedUser.permissions)) {
    return typedUser.permissions.includes(permission);
  }
  if (user.role.code === 'OWNER' || user.role.code === 'ADMIN') return true;
  return (
    fallbackPermissions[user.role.code as RoleCode]?.includes(permission) ??
    false
  );
}

export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: string[],
) {
  return permissions.some((permission) => hasPermission(user, permission));
}
