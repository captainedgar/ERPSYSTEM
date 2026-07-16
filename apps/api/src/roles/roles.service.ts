import { Injectable } from '@nestjs/common';
import { type Prisma, UserRole } from '@prisma/client';

import { PermissionsService } from '../permissions/permissions.service';
import rolePermissionMatrix from './company-role-permissions.json';

const ROLE_NAMES: Record<UserRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
  ACCOUNTING: 'Contabilidad',
};

type StandardRole = Exclude<UserRole, 'OWNER'>;

export const ROLE_PERMISSION_CODES = rolePermissionMatrix satisfies Record<
  StandardRole,
  string[]
>;

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
