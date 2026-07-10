INSERT INTO "permissions" ("id", "code", "module", "action", "description", "createdAt", "updatedAt")
VALUES
    ('perm_reports_view', 'reports.view', 'reports', 'VIEW', 'Ver reportes generales', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_reports_sales', 'reports.sales', 'reports', 'VIEW', 'Ver reportes de ventas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_reports_cash', 'reports.cash', 'reports', 'VIEW', 'Ver reportes de caja', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_reports_inventory', 'reports.inventory', 'reports', 'VIEW', 'Ver reportes de inventario', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_reports_customers', 'reports.customers', 'reports', 'VIEW', 'Ver reportes de clientes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_reports_documents', 'reports.documents', 'reports', 'VIEW', 'Ver reportes de documentos internos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
    'rp_' || md5(r."id" || p."id"),
    r."id",
    p."id",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE (
    r."code" IN ('OWNER', 'ADMIN')
    AND p."code" IN (
        'reports.view',
        'reports.sales',
        'reports.cash',
        'reports.inventory',
        'reports.customers',
        'reports.documents'
    )
) OR (
    r."code" = 'ACCOUNTING'
    AND p."code" IN (
        'reports.view',
        'reports.sales',
        'reports.cash',
        'reports.customers',
        'reports.documents'
    )
) OR (
    r."code" = 'CASHIER'
    AND p."code" IN ('reports.view', 'reports.sales', 'reports.cash')
) OR (
    r."code" = 'SELLER'
    AND p."code" IN ('reports.view', 'reports.sales')
) OR (
    r."code" = 'WAREHOUSE'
    AND p."code" IN ('reports.view', 'reports.inventory')
)
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
