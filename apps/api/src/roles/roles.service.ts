import { Injectable } from '@nestjs/common';
import { type Prisma, UserRole } from '@prisma/client';

import { PermissionsService } from '../permissions/permissions.service';

const ROLE_NAMES: Record<UserRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
  ACCOUNTING: 'Contabilidad',
};

export const ROLE_PERMISSION_CODES: Record<
  Exclude<UserRole, 'OWNER'>,
  readonly string[]
> = {
  ADMIN: [
    'companies.view',
    'companies.update',
    'branches.view',
    'branches.create',
    'branches.update',
    'branches.change_status',
    'branches.set_main',
    'branches.assign_users',
    'users.view',
    'users.create',
    'users.update',
    'users.disable',
    'roles.view',
    'roles.assign',
    'settings.view',
    'settings.update',
    'categories.view',
    'categories.create',
    'categories.update',
    'categories.disable',
    'brands.view',
    'brands.create',
    'brands.update',
    'brands.disable',
    'units.view',
    'units.create',
    'units.update',
    'units.disable',
    'products.view',
    'products.create',
    'products.update',
    'products.disable',
    'products.import',
    'product_compatibility.view',
    'product_compatibility.manage',
    'services.view',
    'services.create',
    'services.update',
    'services.disable',
    'inventory.view',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.view_movements',
    'inventory.view_low_stock',
    'customers.view',
    'customers.create',
    'customers.update',
    'customers.change_status',
    'pos.access',
    'pos.validate_cart',
    'sales.view',
    'sales.create',
    'sales.cancel',
    'sales.view_detail',
    'cash.view',
    'cash.open',
    'cash.close',
    'cash.manual_movement',
    'cash.view_sessions',
    'reports.view',
    'reports.sales',
    'reports.cash',
    'reports.inventory',
    'reports.customers',
    'reports.documents',
    'data_export.view',
    'data_export.products',
    'data_export.inventory',
    'data_export.customers',
    'data_export.sales',
    'data_export.cash',
    'data_export.documents',
    'financial_dashboard.view',
    'financial_dashboard.sales',
    'financial_dashboard.cash',
    'financial_dashboard.inventory',
    'financial_dashboard.customers',
    'financial_dashboard.branches',
    'internal_documents.view',
    'internal_documents.create',
    'internal_documents.print',
    'internal_documents.void',
    'fiscal.settings.view',
    'fiscal.providers.view',
    'fiscal.documents.view',
    'fiscal.documents.create',
    'fiscal.documents.view_events',
    'fiscal.documents.view_errors',
  ],
  CASHIER: [
    'branches.view',
    'categories.view',
    'brands.view',
    'units.view',
    'products.view',
    'product_compatibility.view',
    'services.view',
    'inventory.view',
    'inventory.view_low_stock',
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
    'categories.view',
    'brands.view',
    'units.view',
    'products.view',
    'product_compatibility.view',
    'services.view',
    'inventory.view',
    'inventory.view_low_stock',
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
    'financial_dashboard.view',
    'financial_dashboard.sales',
    'financial_dashboard.cash',
    'financial_dashboard.customers',
  ],
};

export function permissionCodesForRole(
  role: UserRole,
  allPermissionCodes: readonly string[],
) {
  return role === UserRole.OWNER
    ? [...allPermissionCodes]
    : [...ROLE_PERMISSION_CODES[role]];
}

export function roleAllowsPermission(role: UserRole, permission: string) {
  return (
    role === UserRole.OWNER || ROLE_PERMISSION_CODES[role].includes(permission)
  );
}

@Injectable()
export class RolesService {
  constructor(private readonly permissionsService: PermissionsService) {}

  async initializeCompanyRoles(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    const permissions = await this.permissionsService.ensureBasePermissions(tx);
    const roles = await Promise.all(
      Object.values(UserRole).map((code) =>
        tx.role.create({
          data: {
            companyId,
            code,
            name: ROLE_NAMES[code],
            description: `Rol base ${ROLE_NAMES[code]}`,
          },
        }),
      ),
    );

    for (const role of roles) {
      const allowedCodes = permissionCodesForRole(
        role.code,
        permissions.map(({ code }) => code),
      );
      const allowedIds = permissions
        .filter(({ code }) => allowedCodes.includes(code))
        .map(({ id }) => id);
      if (allowedIds.length) {
        await tx.rolePermission.createMany({
          data: allowedIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
    }

    const ownerRole = roles.find(({ code }) => code === UserRole.OWNER);
    if (!ownerRole) throw new Error('Owner role was not initialized');
    return ownerRole;
  }
}
