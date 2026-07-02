import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('roles.view')
  findAll(@CurrentUser() user: AuthUser) {
    return this.prisma.role.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, code: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
}
