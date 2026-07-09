import type { CompanyStatus, UserRole } from '@prisma/client';

export interface AuthUser {
  userId: string;
  companyId: string;
  branchId: string | null;
  roleId: string;
  roleCode: UserRole;
  companyStatus: CompanyStatus;
  sessionId: string;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}
