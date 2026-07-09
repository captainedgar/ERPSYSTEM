import type { PlatformRole } from '@prisma/client';

export interface PlatformAuthUser {
  platformUserId: string;
  role: PlatformRole;
  sessionId: string;
}

export interface PlatformRequestContext {
  ipAddress?: string;
  userAgent?: string;
}
