import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { User, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
  AuthUser,
  RequestContext,
} from '../common/interfaces/auth-user.interface';

type SessionUser = Pick<User, 'id' | 'companyId' | 'branchId'> & {
  role: Pick<Role, 'id' | 'code'>;
};

interface RefreshClaims extends AuthUser {
  type: 'refresh';
  tokenId: string;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async create(user: SessionUser, context: RequestContext) {
    const sessionId = randomUUID();
    const tokens = await this.issueTokens(user, sessionId);
    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hash(tokens.refreshToken),
        expiresAt: this.refreshExpiration(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return tokens;
  }

  async rotate(refreshToken: string) {
    let claims: RefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshClaims>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (claims.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: {
          is: {
            status: 'ACTIVE',
            deletedAt: null,
            company: { status: 'ACTIVE', deletedAt: null },
          },
        },
      },
      include: {
        user: { include: { role: true } },
      },
    });
    if (!session || session.refreshTokenHash !== this.hash(refreshToken)) {
      throw new UnauthorizedException('Refresh session is no longer valid');
    }

    const tokens = await this.issueTokens(session.user, session.id);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hash(tokens.refreshToken) },
    });
    return { tokens, user: session.user };
  }

  revoke(sessionId: string, userId: string) {
    return this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: SessionUser, sessionId: string) {
    const claims: AuthUser = {
      userId: user.id,
      companyId: user.companyId,
      branchId: user.branchId,
      roleId: user.role.id,
      roleCode: user.role.code,
      sessionId,
    };
    const accessOptions: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as JwtSignOptions['expiresIn'],
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...claims, tokenId: randomUUID() }, accessOptions),
      this.jwt.signAsync(
        { ...claims, type: 'refresh', tokenId: randomUUID() },
        refreshOptions,
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiration() {
    const value = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const match = /^(\d+)([mhd])$/.exec(value);
    if (!match) throw new Error('JWT_REFRESH_EXPIRES_IN must use m, h, or d');
    const amount = Number(match[1]);
    const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(
      Date.now() + amount * multipliers[match[2] as 'm' | 'h' | 'd'],
    );
  }
}
