import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { PlatformUserStatus } from '@prisma/client';
import { compare } from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformLoginDto } from './platform-auth.dto';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';

const platformUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: PlatformAuditService,
  ) {}

  async login(dto: PlatformLoginDto, context: PlatformRequestContext) {
    const user = await this.prisma.platformUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (
      !user ||
      user.status !== PlatformUserStatus.ACTIVE ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid platform credentials');
    }

    const sessionId = randomUUID();
    const claims: PlatformAuthUser = {
      platformUserId: user.id,
      role: user.role,
      sessionId,
    };
    const accessToken = await this.jwt.signAsync(
      { ...claims, tokenType: 'platform_access', tokenId: randomUUID() },
      this.accessOptions(),
    );
    await this.prisma.$transaction([
      this.prisma.platformUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.platformSession.create({
        data: {
          id: sessionId,
          platformUserId: user.id,
          accessTokenHash: this.hash(accessToken),
          expiresAt: this.accessExpiration(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
    ]);
    await this.audit.create({
      user: claims,
      action: 'PLATFORM_LOGIN',
      module: 'platform_auth',
      description: 'Inicio de sesion de plataforma',
      ...context,
    });
    return {
      accessToken,
      user: await this.findPublicUser(user.id),
    };
  }

  async logout(user: PlatformAuthUser, context: PlatformRequestContext) {
    await this.prisma.platformSession.updateMany({
      where: {
        id: user.sessionId,
        platformUserId: user.platformUserId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await this.audit.create({
      user,
      action: 'PLATFORM_LOGOUT',
      module: 'platform_auth',
      description: 'Sesion de plataforma cerrada',
      ...context,
    });
    return { success: true };
  }

  me(user: PlatformAuthUser) {
    return this.findPublicUser(user.platformUserId);
  }

  private findPublicUser(id: string) {
    return this.prisma.platformUser.findUniqueOrThrow({
      where: { id },
      select: platformUserSelect,
    });
  }

  private accessOptions(): JwtSignOptions {
    return {
      secret:
        this.config.get<string>('PLATFORM_JWT_SECRET') ??
        this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>(
        'PLATFORM_JWT_EXPIRES_IN',
        '8h',
      ) as JwtSignOptions['expiresIn'],
    };
  }

  private accessExpiration() {
    const value = this.config.get<string>('PLATFORM_JWT_EXPIRES_IN', '8h');
    const match = /^(\d+)([mhd])$/.exec(value);
    if (!match) throw new Error('PLATFORM_JWT_EXPIRES_IN must use m, h, or d');
    const amount = Number(match[1]);
    const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(
      Date.now() + amount * multipliers[match[2] as 'm' | 'h' | 'd'],
    );
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
