INSERT INTO "permissions" ("id", "code", "module", "action", "createdAt", "updatedAt") VALUES
('phase7_pos_access', 'pos.access', 'pos', 'VIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('phase7_pos_validate_cart', 'pos.validate_cart', 'pos', 'UPDATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "module" = EXCLUDED."module",
  "action" = EXCLUDED."action",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'phase7_' || md5(r."id" || p."id"), r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'pos'
WHERE r."code" IN ('OWNER', 'ADMIN', 'CASHIER', 'SELLER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
