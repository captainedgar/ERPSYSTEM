import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthUser } from '../interfaces/auth-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { roleAllowsPermission } from '../../roles/roles.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    if (
      required.some(
        (permission) =>
          !roleAllowsPermission(request.user.roleCode, permission),
      )
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const count = await this.prisma.rolePermission.count({
      where: {
        roleId: request.user.roleId,
        role: { companyId: request.user.companyId, isActive: true },
        permission: { code: { in: required } },
      },
    });
    if (count !== required.length) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
