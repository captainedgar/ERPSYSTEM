ALTER TABLE "branches"
ADD COLUMN "email" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "province" TEXT;

CREATE TABLE "user_branch_memberships" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_branch_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_branch_memberships_userId_branchId_key"
ON "user_branch_memberships"("userId", "branchId");

CREATE INDEX "user_branch_memberships_companyId_userId_isDefault_idx"
ON "user_branch_memberships"("companyId", "userId", "isDefault");

CREATE INDEX "user_branch_memberships_companyId_branchId_idx"
ON "user_branch_memberships"("companyId", "branchId");

ALTER TABLE "user_branch_memberships"
ADD CONSTRAINT "user_branch_memberships_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_branch_memberships"
ADD CONSTRAINT "user_branch_memberships_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_branch_memberships"
ADD CONSTRAINT "user_branch_memberships_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_branch_memberships" (
    "id",
    "companyId",
    "userId",
    "branchId",
    "isDefault",
    "updatedAt"
)
SELECT
    'ubm_' || md5(random()::text || clock_timestamp()::text || u."id"),
    u."companyId",
    u."id",
    u."branchId",
    true,
    CURRENT_TIMESTAMP
FROM "users" u
INNER JOIN "branches" b
    ON b."id" = u."branchId"
    AND b."companyId" = u."companyId"
WHERE u."branchId" IS NOT NULL
ON CONFLICT ("userId", "branchId") DO NOTHING;

WITH ranked AS (
    SELECT
        "id",
        row_number() OVER (
            PARTITION BY "companyId"
            ORDER BY
                CASE WHEN "isMain" AND "status" = 'ACTIVE' THEN 0 ELSE 1 END,
                "createdAt",
                "id"
        ) AS rn
    FROM "branches"
    WHERE "deletedAt" IS NULL
      AND "status" = 'ACTIVE'
)
UPDATE "branches" b
SET "isMain" = ranked.rn = 1
FROM ranked
WHERE b."id" = ranked."id";

INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "updatedAt")
VALUES
    ('perm_branches_change_status', 'branches.change_status', 'branches', 'DISABLE', 'Activar o desactivar sucursales', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_branches_set_main', 'branches.set_main', 'branches', 'UPDATE', 'Marcar sucursal principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_branches_assign_users', 'branches.assign_users', 'branches', 'UPDATE', 'Asignar usuarios a sucursales', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
    'rp_' || md5(r."id" || p."id"),
    r."id",
    p."id",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('OWNER', 'ADMIN')
  AND p."code" IN (
      'branches.change_status',
      'branches.set_main',
      'branches.assign_users'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
