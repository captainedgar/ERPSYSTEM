# Matriz de roles y permisos

Fecha de revisión: 2026-07-16

Esta matriz es la fuente de verdad funcional para los roles empresariales predefinidos. El backend sigue siendo la autoridad: una asociación histórica en `RolePermission` no habilita una acción prohibida por esta matriz.

## Convenciones

- **Administrar**: ver, crear, editar y cambiar estado cuando existen esas operaciones.
- **Operar**: ejecutar acciones propias del módulo sin administrar su configuración.
- **Ver**: consulta sin mutaciones administrativas.
- **No**: no permitido.

| Módulo | OWNER | ADMIN | CASHIER | SELLER | WAREHOUSE | ACCOUNTING |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Ver todo | Ver operativo y financiero | Ver operativo | Ver operativo | Ver inventario | Ver financiero |
| POS | Operar | Operar | Operar | Operar | No | No |
| Ventas | Administrar | Administrar | Crear/ver | Crear/ver | No | Ver |
| Caja | Administrar | Administrar | Operar | Ver actual | No | Ver sesiones |
| Clientes | Administrar | Administrar | Ver/crear | Ver/crear | No | Ver/editar |
| Productos | Administrar | Administrar | Ver | Ver | Crear/editar/ver | Ver |
| Servicios | Administrar | Administrar | Ver | Ver | Ver | Ver |
| Categorías, marcas y unidades | Administrar | Administrar | Ver | Ver | Crear/editar/ver | No |
| Importación Excel | Administrar | Administrar | No | No | Importar | No |
| Compatibilidad | Administrar | Administrar | Ver | Ver | Administrar | No |
| Inventario | Administrar | Administrar | Ver/bajo stock | Ver/bajo stock | Ajustar/ver | Ver |
| Transferencias | Administrar | Administrar | No | No | Crear/ver | No |
| Documentos internos | Administrar | Administrar | Crear/ver/imprimir | Crear/ver/imprimir | No | Ver/imprimir/anular |
| Fiscal mock | Administrar | Ver/crear | Ver documentos | No | No | Administrar sandbox mock |
| Reportes | Todos | Todos | Ventas/caja | Ventas | Inventario | Ventas/caja/clientes/documentos |
| Dashboard financiero | Todos | Todos | Ventas/caja | Ventas | Inventario | Ventas/caja/clientes |
| Exportaciones | Todas | Operativas, sin backup | Ventas/caja | Ventas | Productos/inventario | Ventas/caja/clientes/documentos |
| Backup | Administrar | No | No | No | No | No |
| Empresa | Administrar | Ver | No | No | No | Ver |
| Sucursales | Administrar | Administrar | Ver asignadas | Ver asignadas | Ver asignadas | Ver asignadas |
| Usuarios | Administrar | Administrar usuarios no OWNER | No | No | No | No |
| Roles | Ver y asignar | Ver y asignar roles no OWNER | No | No | No | No |
| Configuración negocio | Administrar | Administrar | No | No | No | No |
| Platform Admin | No | No | No | No | No | No |

## Permisos administrativos reales

| Concepto solicitado | Código real |
| --- | --- |
| Estado de sucursal | `branches.change_status` |
| Asignar usuarios/sucursales | `branches.assign_users` |
| Estado de usuario | `users.disable` |
| Asignar rol | `roles.assign` |
| Configuración negocio | `settings.view`, `settings.update` |
| Backup completo | `data_export.full_backup` |
| Fiscal configuración | `fiscal.settings.view`, `fiscal.settings.update` |
| Fiscal documentos | `fiscal.documents.*` |

No existen `branches.disable`, `users.change_status`, `users.assign_role`, `users.assign_branches`, `roles.manage`, `business_settings.*` ni `fiscal.invoices.*`. Se usan los códigos reales indicados arriba.

## Reglas de jerarquía

- La empresa tiene un único OWNER fundador.
- No se puede crear otro OWNER ni asignar el rol OWNER.
- El OWNER no puede desactivarse a sí mismo ni cambiar su propio rol.
- ADMIN puede crear y administrar ADMIN, CASHIER, SELLER, WAREHOUSE y ACCOUNTING.
- ADMIN no puede editar, desactivar ni degradar al OWNER.
- Crear usuarios requiere `users.create` y `roles.assign`.
- Cambiar un rol requiere `users.update` y `roles.assign`.
- Asignar una sucursal requiere `branches.assign_users`.
- Los roles operativos no reciben permisos de usuarios, roles ni administración estructural de sucursales.

## Implementación

La matriz se aplica en tres puntos:

1. Creación de roles para empresas nuevas.
2. Techo efectivo aplicado por el guard y por `/auth/me`.
3. Sincronización idempotente del seed demo para agregar la matriz vigente. Las asociaciones históricas sobrantes no se borran por la política de seed no destructivo y quedan neutralizadas por el techo efectivo.

## Sincronización para empresas existentes

La fuente técnica compartida está en:

`apps/api/src/roles/company-role-permissions.json`

API, seed demo y sincronización consumen esta misma matriz. Para completar asociaciones persistidas de empresas creadas con una versión anterior:

```powershell
$env:CONFIRM_SYNC_RBAC="true"; npm run rbac:sync-company-roles
```

El comando:

- procesa únicamente empresas y roles empresariales;
- crea roles estándar faltantes;
- agrega permisos canónicos faltantes;
- informa asociaciones incompatibles;
- no modifica Platform Admin;
- no borra asociaciones, usuarios, empresas ni datos operativos;
- puede ejecutarse repetidamente.

Para roles estándar, `/auth/me` y los guards usan directamente la matriz canónica. Por tanto, un permiso canónico faltante en `RolePermission` sigue siendo efectivo, mientras que uno histórico incompatible permanece neutralizado.
