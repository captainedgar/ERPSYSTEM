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
    'inventory.view',
    'inventory.adjust',
    'inventory.view_movements',
    'inventory.view_low_stock',
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
