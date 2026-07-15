# Auditoría de rutas backend / frontend

Fecha: 2026-07-15

## Criterio

Se contrastaron los controladores NestJS, las páginas del App Router, la navegación del shell de empresa y los permisos efectivos recibidos por `/auth/me`. Todas las rutas de empresa se filtran por permisos; el shell de Platform Admin permanece separado bajo `/platform`.

## Cobertura funcional

| Módulo | Backend endpoints | Frontend route | Sidebar visible | Estado | Acción tomada |
| --- | --- | --- | --- | --- | --- |
| Auth de empresa | `/auth/register-company`, `/login`, `/refresh`, `/logout`, `/me` | `/login`, `/register` | No aplica | Backend sin pantalla directa necesaria | Se mantiene fuera del shell |
| Empresa y negocio | `/companies/me`, `/companies/me/logo`, `/business-settings`, `/templates`, `/apply-template`, `/complete-onboarding` | `/settings/business`, `/onboarding/business` | Sí | Cubierto | Se añadieron accesos administrativos |
| Usuarios | `/users`, `/users/:id`, `/users/:id/status` | `/settings/users`, `/new`, `/[id]` | Sí | Cubierto pero faltaba enlace | Enlace y acción **Nuevo usuario** destacados |
| Roles | `/roles` | `/settings/roles` | Sí | Cubierto pero faltaba enlace | Se muestran permisos en modo lectura |
| Sucursales | `/branches`, `/available`, `/users/:id/branches`, `/:id/users` | `/settings/branches`, `/new`, `/[id]` | Sí | Cubierto | Enlace conservado y acceso rápido añadido |
| Operación | `/pos`, `/sales`, `/cash`, `/customers`, `/internal-documents` y detalles | Rutas equivalentes | Sí | Cubierto | Clientes y documentos se movieron a Operación |
| Inventario | `/inventory`, `/low-stock`, movimientos, stock por sucursal y transferencias | `/inventory`, `/low-stock`, `/transfers`, detalles y movimientos | Sí | Cubierto | Sin cambio funcional |
| Catálogo | `/products`, importación, compatibilidad, `/services`, `/categories`, `/brands`, `/units` | `/catalog/*` | Sí | Cubierto pero faltaba enlace visible | Importar Excel queda visible y sin solapamiento |
| Fiscal mock | `/fiscal/settings`, proveedores mock y `/electronic-invoices/*` | `/fiscal/settings`, `/fiscal/electronic-invoices`, `/[id]` | Sí | Cubierto | Grupo propio; se mantiene estrictamente mock |
| Reportes | `/reports/overview`, ventas y desgloses, caja, clientes, inventario, documentos | `/reports` y subrutas | Sí | Cubierto | Se conservaron todas las subrutas |
| Dashboard financiero | `/financial-dashboard/*` | `/financial-dashboard` | Sí | Cubierto | Enlace priorizado en Analítica |
| Exportación | `/data-export/*`, incluido backup | `/data-export` | Sí | Cubierto | Sin cambio funcional |
| Platform Admin | `/platform/auth/*`, métricas, empresas, planes, billing, invoices, audit | `/platform/*` | Shell propio | Platform only | Se confirmó separación del shell empresarial |
| Links públicos de pago | `/pay/invoice/:token`, `/:token/report` | `/pay/invoice/[token]` | No | Público/no sidebar | Sin cambio |

## Permisos y visibilidad

| Enlace | Regla efectiva |
| --- | --- |
| Usuarios | Cualquiera de `users.view`, `users.create`, `users.update`, `users.disable` |
| Roles | `roles.view` |
| Sucursales | `branches.view` |
| Empresa | `settings.view` |
| Importar Excel | `products.import` |
| Fiscal settings | `fiscal.settings.view` |
| Comprobantes e-CF | `fiscal.documents.view` |
| Resto de módulos | El permiso `*.view` o permiso operativo específico exigido por su controlador |

La denominación real para activar o desactivar usuarios es `users.disable`; no existe `users.change_status` en el catálogo backend. Los accesos rápidos de administración en `/settings/business` aplican las mismas reglas.

## Correcciones aplicadas

- Se reorganizó el sidebar según el recorrido comercial acordado.
- Se separaron las entradas fiscal mock y comprobantes e-CF mock.
- El sidebar de escritorio ahora tiene desplazamiento vertical propio.
- La tarjeta absoluta de empresa fue eliminada; la empresa activa se muestra compacta y truncada en el topbar.
- `/settings/business` incluye accesos condicionales a usuarios, sucursales y roles.
- `/settings/users` presenta una acción primaria **Nuevo usuario** y mantiene creación, edición, rol, sucursal y estado protegidos por permisos.
- `GET /roles` devuelve los códigos de permisos relacionados, sin datos sensibles, y `/settings/roles` los muestra en modo consulta. No se añadió editor.

## Rutas sin entrada directa en sidebar

Las vistas de detalle, formularios, impresión y onboarding se alcanzan desde su flujo padre: ventas por id, sesiones de caja, movimientos de producto, detalle de transferencia, detalle/impresión de documento interno, alta/edición de sucursal, alta/edición de usuario, detalle fiscal y onboarding. Esto evita duplicar navegación sin dejar funcionalidad huérfana.

## Límites confirmados

- No se implementó facturación electrónica real ni conexión con DGII.
- No se añadió edición granular de roles.
- No se mezcló el contexto multiempresa con Platform Admin.
- No se exponen hashes de contraseña, sesiones ni refresh tokens.

Antes de esta corrección, `/users` y `/roles` ya estaban implementados en backend y tenían páginas, pero su presencia no era suficientemente visible dentro del recorrido de configuración comercial.
