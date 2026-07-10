INSERT INTO permissions (id, code, module, action, description, "createdAt", "updatedAt")
VALUES
  ('perm_products_import', 'products.import', 'products', 'CREATE', 'products.import', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, "roleId", "permissionId", "createdAt")
SELECT concat('rp_', r.id, '_products_import'), r.id, p.id, now()
FROM roles r
JOIN permissions p ON p.code = 'products.import'
WHERE r.code IN ('OWNER', 'ADMIN', 'WAREHOUSE')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
