import type { UserRole } from '@prisma/client';

export interface AuthUser {
  userId: string;
  companyId: string;
  branchId: string | null;
  roleId: string;
  roleCode: UserRole;
  sessionId: string;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}
