import { PermissionAction, PrismaClient, UserRole } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const canonicalRolePermissions = JSON.parse(
  readFileSync(
    new URL(
      '../../../apps/api/src/roles/company-role-permissions.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

const roleNames = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
  ACCOUNTING: 'Contabilidad',
};

async function main() {
  if (process.env.CONFIRM_SYNC_RBAC !== 'true') {
    throw new Error(
      'Define CONFIRM_SYNC_RBAC=true para sincronizar los roles empresariales.',
    );
  }

  const canonicalCodes = [
    ...new Set(Object.values(canonicalRolePermissions).flat()),
  ];
  for (const code of canonicalCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {
        module: code.split('.')[0],
        action: permissionAction(code),
      },
      create: {
        code,
        module: code.split('.')[0],
        action: permissionAction(code),
      },
    });
  }

  const [companies, permissions] = await Promise.all([
    prisma.company.findMany({ select: { id: true } }),
    prisma.permission.findMany({ select: { id: true, code: true } }),
  ]);
  const permissionByCode = new Map(
    permissions.map((permission) => [permission.code, permission]),
  );
  let rolesProcessed = 0;
  let permissionsAdded = 0;
  let incompatibleDetected = 0;

  for (const company of companies) {
    for (const code of Object.values(UserRole)) {
      const role = await prisma.role.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: { name: roleNames[code], isActive: true },
        create: {
          companyId: company.id,
          code,
          name: roleNames[code],
          description: `Rol base ${roleNames[code]}`,
        },
      });
      rolesProcessed += 1;

      const allowedCodes =
        code === UserRole.OWNER
          ? permissions.map(({ code: permissionCode }) => permissionCode)
          : canonicalRolePermissions[code];
      const allowedSet = new Set(allowedCodes);
      const existing = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
        select: { permissionId: true, permission: { select: { code: true } } },
      });
      const existingIds = new Set(
        existing.map(({ permissionId }) => permissionId),
      );
      incompatibleDetected += existing.filter(
        ({ permission }) => !allowedSet.has(permission.code),
      ).length;

      for (const permissionCode of allowedCodes) {
        const permission = permissionByCode.get(permissionCode);
        if (!permission || existingIds.has(permission.id)) continue;
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
        permissionsAdded += 1;
      }
    }
  }

  console.table([
    {
      empresasProcesadas: companies.length,
      rolesProcesados: rolesProcessed,
      permisosAgregados: permissionsAdded,
      incompatiblesDetectados: incompatibleDetected,
      incompatiblesNeutralizados: incompatibleDetected,
      accionesDestructivas: 0,
    },
  ]);
  console.log(
    'Sincronización RBAC completada. Los permisos incompatibles no se borraron; la matriz canónica los neutraliza en /auth/me y guards.',
  );
}

function permissionAction(code) {
  if (/\.(create|open|import)$/.test(code)) return PermissionAction.CREATE;
  if (/\.(disable|change_status|cancel|void)$/.test(code)) {
    return PermissionAction.DISABLE;
  }
  if (
    /\.view($|_)|\.access$|^reports\.|^data_export\.|^financial_dashboard\./.test(
      code,
    )
  ) {
    return PermissionAction.VIEW;
  }
  return PermissionAction.UPDATE;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
