CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_ADMIN', 'BILLING_ADMIN', 'AUDITOR');

CREATE TYPE "PlatformUserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'SUPPORT_ADMIN',
    "status" "PlatformUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_sessions" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "metadataJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");
CREATE INDEX "platform_users_status_role_idx" ON "platform_users"("status", "role");
CREATE INDEX "platform_sessions_platformUserId_revokedAt_idx" ON "platform_sessions"("platformUserId", "revokedAt");
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt");
CREATE INDEX "platform_audit_logs_platformUserId_createdAt_idx" ON "platform_audit_logs"("platformUserId", "createdAt");

ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
