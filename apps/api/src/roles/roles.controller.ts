import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { roleAllowsPermission } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles.view')
  async findAll(@CurrentUser() user: AuthUser) {
    const roles = await this.prisma.role.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        rolePermissions: {
          select: { permission: { select: { code: true } } },
          orderBy: { permission: { code: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => ({
      ...role,
      rolePermissions: role.rolePermissions.filter(({ permission }) =>
        roleAllowsPermission(role.code, permission.code),
      ),
    }));
  }
}
