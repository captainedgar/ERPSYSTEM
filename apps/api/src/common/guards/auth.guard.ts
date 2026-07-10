import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BranchStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../interfaces/auth-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const claims = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if ('type' in claims) {
        throw new Error('Refresh token cannot be used as access token');
      }
      const session = await this.prisma.userSession.findFirst({
        where: {
          id: claims.sessionId,
          userId: claims.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: {
            is: {
              companyId: claims.companyId,
              status: 'ACTIVE',
              deletedAt: null,
              company: { deletedAt: null },
            },
          },
        },
        select: {
          user: {
            select: {
              id: true,
              companyId: true,
              branchId: true,
              company: { select: { status: true } },
              role: { select: { id: true, code: true } },
            },
          },
        },
      });
      if (!session) throw new Error('Session revoked');
      const activeBranchId = await this.resolveActiveBranch(
        request,
        session.user.id,
        session.user.companyId,
        session.user.branchId,
        session.user.role.code,
      );
      request.user = {
        userId: session.user.id,
        companyId: session.user.companyId,
        branchId: activeBranchId,
        roleId: session.user.role.id,
        roleCode: session.user.role.code,
        companyStatus: session.user.company.status,
        sessionId: claims.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private async resolveActiveBranch(
    request: Request,
    userId: string,
    companyId: string,
    defaultBranchId: string | null,
    roleCode: UserRole,
  ) {
    const requestedBranchId = request.header('x-branch-id')?.trim();
    if (requestedBranchId) {
      return this.validateBranchAccess(
        requestedBranchId,
        userId,
        companyId,
        roleCode,
      );
    }

    if (defaultBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: defaultBranchId,
          companyId,
          deletedAt: null,
          status: BranchStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (branch) return branch.id;
    }

    const membership = await this.prisma.userBranchMembership.findFirst({
      where: {
        companyId,
        userId,
        branch: { status: BranchStatus.ACTIVE, deletedAt: null },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { branchId: true },
    });
    if (membership) return membership.branchId;

    const main = await this.prisma.branch.findFirst({
      where: {
        companyId,
        deletedAt: null,
        status: BranchStatus.ACTIVE,
        isMain: true,
      },
      select: { id: true },
    });
    return main?.id ?? null;
  }

  private async validateBranchAccess(
    branchId: string,
    userId: string,
    companyId: string,
    roleCode: UserRole,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        deletedAt: null,
        status: BranchStatus.ACTIVE,
      },
      select: {
        id: true,
        users: { where: { id: userId }, select: { id: true } },
        userMemberships: {
          where: { userId },
          select: { id: true },
        },
      },
    });
    if (!branch) throw new UnauthorizedException('Invalid active branch');
    if (roleCode === UserRole.OWNER || roleCode === UserRole.ADMIN) {
      return branch.id;
    }
    if (branch.users.length || branch.userMemberships.length) {
      return branch.id;
    }
    throw new UnauthorizedException('Branch not allowed for user');
  }
}
