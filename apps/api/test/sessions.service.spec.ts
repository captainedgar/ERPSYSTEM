import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';

import { SessionsService } from '../src/sessions/sessions.service';

describe('SessionsService', () => {
  let createdSessionData: { refreshTokenHash: string } | undefined;
  let sessionRecord:
    | {
        id: string;
        userId: string;
        refreshTokenHash: string;
        expiresAt: Date;
      }
    | undefined;
  const configValues: Record<string, string> = {
    JWT_SECRET: 'access-secret-for-tests',
    JWT_REFRESH_SECRET: 'refresh-secret-for-tests',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
  const config = {
    get: (key: string, fallback?: string) => configValues[key] ?? fallback,
    getOrThrow: (key: string) => {
      const value = configValues[key];
      if (!value) throw new Error(`Missing ${key}`);
      return value;
    },
  } as ConfigService;
  const user = {
    id: 'user-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    role: { id: 'role-1', code: UserRole.OWNER },
  };
  const prisma = {
    userSession: {
      create: jest.fn(
        (args: {
          data: {
            id: string;
            userId: string;
            refreshTokenHash: string;
            expiresAt: Date;
          };
        }): Promise<void> => {
          createdSessionData = args.data;
          sessionRecord = args.data;
          return Promise.resolve();
        },
      ),
      findFirst: jest.fn(() =>
        Promise.resolve(
          sessionRecord ? { ...sessionRecord, user, revokedAt: null } : null,
        ),
      ),
      update: jest.fn(
        (args: { data: { refreshTokenHash: string } }): Promise<void> => {
          if (sessionRecord) {
            sessionRecord.refreshTokenHash = args.data.refreshTokenHash;
          }
          return Promise.resolve();
        },
      ),
    },
  };
  const service = new SessionsService(
    prisma as never,
    new JwtService(),
    config,
  );

  beforeEach(() => {
    prisma.userSession.create.mockClear();
    prisma.userSession.findFirst.mockClear();
    prisma.userSession.update.mockClear();
    createdSessionData = undefined;
    sessionRecord = undefined;
  });

  it('issues a unique refresh token for each new session', async () => {
    const first = await service.create(user, {});
    const second = await service.create(user, {});

    expect(first.refreshToken).not.toBe(second.refreshToken);
  });

  it('stores only the refresh token hash', async () => {
    const tokens = await service.create(user, {});

    expect(createdSessionData?.refreshTokenHash).toHaveLength(64);
    expect(createdSessionData?.refreshTokenHash).not.toBe(tokens.refreshToken);
    expect(JSON.stringify(createdSessionData)).not.toContain(
      tokens.refreshToken,
    );
  });

  it('rotates a refresh token even within the same second', async () => {
    const initial = await service.create(user, {});
    const rotated = await service.rotate(initial.refreshToken);

    expect(rotated.tokens.refreshToken).not.toBe(initial.refreshToken);
    expect(prisma.userSession.update).toHaveBeenCalledTimes(1);
  });
});
