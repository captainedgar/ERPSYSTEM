import { PermissionAction } from '@prisma/client';

export const PERMISSIONS = [
  ['companies.view', 'companies', PermissionAction.VIEW],
  ['companies.update', 'companies', PermissionAction.UPDATE],
  ['branches.view', 'branches', PermissionAction.VIEW],
  ['branches.create', 'branches', PermissionAction.CREATE],
  ['branches.update', 'branches', PermissionAction.UPDATE],
  ['users.view', 'users', PermissionAction.VIEW],
  ['users.create', 'users', PermissionAction.CREATE],
  ['users.update', 'users', PermissionAction.UPDATE],
  ['users.disable', 'users', PermissionAction.DISABLE],
  ['roles.view', 'roles', PermissionAction.VIEW],
  ['settings.view', 'settings', PermissionAction.VIEW],
  ['settings.update', 'settings', PermissionAction.UPDATE],
] as const;
