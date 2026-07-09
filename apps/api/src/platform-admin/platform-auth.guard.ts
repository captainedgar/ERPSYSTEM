import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import type { PlatformAuthUser } from './platform.types';

interface PlatformAccessClaims extends PlatformAuthUser {
  tokenType: 'platform_access';
  tokenId: string;
}

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { platformUser: PlatformAuthUser }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Platform authentication required');
    }

    try {
      const claims = await this.jwt.verifyAsync<PlatformAccessClaims>(token, {
        secret: this.platformJwtSecret(),
      });
      if (claims.tokenType !== 'platform_access') {
        throw new Error('Invalid token type');
      }
      const session = await this.prisma.platformSession.findFirst({
        where: {
          id: claims.sessionId,
          platformUserId: claims.platformUserId,
          accessTokenHash: this.hash(token),
          revokedAt: null,
          expiresAt: { gt: new Date() },
          platformUser: { status: 'ACTIVE' },
        },
        select: { platformUser: { select: { id: true, role: true } } },
      });
      if (!session) throw new Error('Session revoked');
      request.platformUser = {
        platformUserId: session.platformUser.id,
        role: session.platformUser.role,
        sessionId: claims.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired platform token');
    }
  }

  private platformJwtSecret() {
    return (
      this.config.get<string>('PLATFORM_JWT_SECRET') ??
      this.config.getOrThrow<string>('JWT_SECRET')
    );
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
