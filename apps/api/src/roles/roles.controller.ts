import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { permissionCodesForRole } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles.view')
  async findAll(@CurrentUser() user: AuthUser) {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: { companyId: user.companyId, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.permission.findMany({
        select: { code: true },
        orderBy: { code: 'asc' },
      }),
    ]);
    const allPermissionCodes = permissions.map(({ code }) => code);
    return roles.map((role) => ({
      ...role,
      rolePermissions: permissionCodesForRole(
        role.code,
        allPermissionCodes,
      ).map((code) => ({ permission: { code } })),
    }));
  }
}
