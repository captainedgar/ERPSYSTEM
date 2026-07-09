import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
      request.user = {
        userId: session.user.id,
        companyId: session.user.companyId,
        branchId: session.user.branchId,
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
}
