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

const LIMITED_PERMISSIONS: Partial<Record<UserRole, string[]>> = {
  CASHIER: [
    'branches.view',
    'categories.view',
    'brands.view',
    'units.view',
    'products.view',
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
  ],
  SELLER: [
    'branches.view',
    'categories.view',
    'brands.view',
    'units.view',
    'products.view',
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
    'inventory.view',
    'inventory.adjust',
    'inventory.view_movements',
    'inventory.view_low_stock',
    'reports.view',
    'reports.inventory',
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
  ],
};

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
      const allowedCodes =
        role.code === UserRole.OWNER || role.code === UserRole.ADMIN
          ? permissions.map(({ code }) => code)
          : (LIMITED_PERMISSIONS[role.code] ?? []);
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
