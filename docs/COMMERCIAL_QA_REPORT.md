# Reporte de QA comercial y hardening técnico

## Resumen ejecutivo

Se ejecutó una revisión comercial sobre la demo local de Comercia ERP. Los flujos de autenticación, sucursales, POS, inventario, ventas, caja, documentos, fiscal mock, reportes, dashboard financiero, exportaciones y Platform Admin respondieron correctamente por API. Se corrigieron dos problemas de alto impacto: la UI todavía autorizaba varias acciones por nombre de rol en vez de permisos efectivos, y el producto solicitado en las alternativas POS mostraba stock global en vez del stock de la sucursal activa.

El build productivo y las pruebas automatizadas cubren las rutas y reglas backend. La inspección visual automatizada quedó limitada porque el navegador integrado no pudo inicializar su conexión; se requiere una última pasada visual humana antes de staging.

## Ambiente probado

- Windows y PowerShell.
- Node.js del workspace y npm workspaces/Turborepo.
- PostgreSQL local del proyecto.
- API local en `http://localhost:3001`.
- Web local en `http://localhost:3000`.
- Datos regenerados con `CONFIRM_SEED_DEMO=true`.
- Fiscal configurado exclusivamente en modo `SANDBOX`/`MOCK`.

## Usuarios demo usados

- `owner@demo.local`
- `cajero@demo.local`
- `vendedor@demo.local`
- `almacen@demo.local`
- `contabilidad@demo.local`
- `admin@platform.local`

No se registraron tokens, hashes ni secretos durante la QA.

## Flujos probados

### Autenticación y sesión

- Login empresarial correcto.
- `/auth/me` devuelve permisos efectivos.
- Rotación de refresh token correcta.
- Logout revoca la sesión; el token posterior recibe `401`.
- Login y sesión de Platform Admin separados de la sesión empresarial.

### Empresa y sucursales

- Se cargaron tres sucursales demo.
- OWNER pudo consultar SDQ y STI mediante `x-branch-id`.
- Inventario, caja, ventas, reportes y dashboard reciben el contexto de sucursal activa.
- El shell de Platform Admin no contiene selector de sucursal empresarial.

### POS, inventario y compatibilidad

- Búsqueda por nombre, SKU y código de barras respondió `200`.
- `BKR6E` identifica la bujía NGK solicitada.
- En SDQ el producto solicitado devuelve stock `0`.
- Se devuelven tres alternativas compatibles con stock en SDQ.
- Inventario, bajo stock, movimientos y transferencias están protegidos por permisos y `companyId`.
- Existen dos transferencias demo visibles por API.

### Caja, ventas y documentos

- Caja actual, historial y detalle responden según permisos.
- Las ventas demo aparecen filtradas por sucursal.
- Se verificaron ventas con varios medios de pago y una cancelada mediante datos seed/E2E.
- Documentos internos y fiscal mock se consultan correctamente.
- Crear, anular, imprimir, enviar o reintentar permanece protegido por su permiso granular.

### Reportes, dashboard y exportaciones

- Reporte general y dashboard financiero respondieron con datos demo.
- Dashboard global reportó siete ventas completadas y ventas brutas demo visibles.
- Exportación de productos y backup XLSX respondieron para OWNER.
- `all_branches` fue rechazado con `403` para roles limitados.

### Platform Admin

- Login, `/platform/auth/me`, métricas, empresas, planes y billing respondieron `200`.
- Los endpoints Platform Admin usan autenticación independiente.

## Problemas encontrados

1. POS, caja, ventas, clientes y documentos internos usaban listas fijas de roles para decidir acceso o visibilidad, aunque el backend ya usa permisos efectivos.
2. Data Export mostraba `Todas las sucursales` a roles que el backend rechaza y mostraba el bloque de backup deshabilitado a usuarios sin permiso.
3. Los accesos rápidos del dashboard se calculaban por rol y no por permisos efectivos.
4. La respuesta de alternativas POS devolvía `Product.stock` global para `requestedProduct`; en SDQ mostraba `11` aunque `ProductBranchStock` era `0`.
5. El seed demo dependía de que todos los permisos globales ya existieran. En una base local incompleta, OWNER no recibía permisos de dashboard financiero ni exportación.
6. No existen rutas dedicadas `/customers/new` y `/customers/[id]`; el CRUD actual está integrado en `/customers`.
7. La automatización visual no pudo conectarse al navegador integrado del entorno de QA.

## Problemas corregidos

- POS ahora usa `pos.access`.
- Caja usa por separado `cash.view`, `cash.open`, `cash.close`, `cash.manual_movement` y `cash.view_sessions`.
- Ventas usa `sales.view`, `sales.create`, `sales.view_detail` y `sales.cancel`.
- Clientes usa `customers.create`, `customers.update` y `customers.change_status`.
- Documentos internos usa `internal_documents.view`, `internal_documents.print` e `internal_documents.void`.
- Dashboard calcula cada acceso rápido con el permiso correspondiente.
- Data Export oculta el alcance global a roles distintos de OWNER/ADMIN y oculta completamente el backup sin `data_export.full_backup`.
- El producto solicitado por compatibilidad ahora recibe stock desde `ProductBranchStock` para la sucursal activa.
- El seed asegura el catálogo base de permisos antes de asignar roles y continúa siendo idempotente y no destructivo.
- Se agregó cobertura E2E para stock de sucursal en `requestedProduct`, tanto por ID como por código alterno.

## QA de permisos

Resultados representativos:

| Perfil | POS | Inventario | Historial caja | Fiscal settings | Usuarios | Export all branches |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Cajero | 200 | 200 | 200 | 403 | 403 | 403 |
| Vendedor | 200 | 200 | 403 | 403 | 403 | 403 |
| Almacén | 403 | 200 | 403 | 403 | 403 | 403 |
| Contabilidad | 403 | 200 | 200 | 200 | 403 | 403 |

Los `403` son respuestas esperadas. Los guards backend siguen siendo la autoridad aunque la UI o una URL se manipulen.

## QA responsive

Se revisó estáticamente la estructura de las pantallas prioritarias:

- Shell empresarial: sidebar solo desde `lg`, navegación horizontal con `overflow-x-auto` en móvil y cabecera flexible.
- Formularios y cards: uso consistente de grids `sm`, `md`, `lg` y `xl`.
- Tablas principales: contenedores con scroll horizontal donde corresponde.
- Selector de sucursal: ancho fluido en móvil, truncado de texto y ancho acotado desde `sm`.
- Dashboard financiero, reportes, importación y Platform Admin incluyen wrappers para overflow.

Pendiente: validar visualmente 390 px, tablet, laptop y desktop en un navegador operativo.

## Hardening técnico

- `apiRequest` evita `response.json()` para respuestas `204` o vacías.
- Cargas asíncronas críticas usan cancelación lógica y estados loading/error.
- Dashboard financiero protege divisiones entre cero.
- Formato monetario y fechas permanecen centralizados en helpers existentes.
- TypeScript estricto, lint y build productivo verifican imports y tipos.
- No se realizó ningún refactor grande.

## Seguridad

- `passwordHash`, `refreshTokenHash` y tokens almacenados no se incluyen en respuestas públicas.
- Auth empresarial y Platform Auth usan guards y almacenamiento separados.
- Queries revisadas mantienen filtro por `companyId`.
- `all_branches` se valida nuevamente en backend y solo admite OWNER/ADMIN.
- `.env`, `node_modules/`, `.turbo/` y `apps/api/uploads/` están ignorados por Git.
- El seed no contiene `delete` ni `deleteMany`, se bloquea en producción y solo admite bases locales.

## Problemas pendientes y riesgos conocidos

- Completar QA visual/manual en un navegador operativo, incluyendo consola y tamaños responsive.
- Decidir si el producto requiere rutas dedicadas para crear/editar clientes o si se mantiene el CRUD en una sola pantalla.
- Una demo que crea ventas altera el stock; regenerar el seed antes de cada presentación.
- Las credenciales demo nunca deben habilitarse en producción.

## Checklist para demo

- [ ] Ejecutar el seed demo inmediatamente antes de presentar.
- [ ] Confirmar API y web locales saludables.
- [ ] Login OWNER y verificar empresa/sucursal.
- [ ] Cambiar SDQ → STI y volver a SDQ.
- [ ] Buscar `BKR6E`, confirmar stock 0 y seleccionar alternativa.
- [ ] Crear venta y revisar caja/documento.
- [ ] Mostrar dashboard financiero y reportes.
- [ ] Descargar una exportación y el backup XLSX.
- [ ] Mostrar fiscal mock y su aviso no productivo.
- [ ] Verificar perfiles limitados.
- [ ] Entrar a Platform Admin con una sesión separada.

## Recomendación antes de staging

Ejecutar una pasada visual humana con el checklist anterior, revisar la consola del navegador y usar credenciales distintas a las de demo. Staging debe tener una base aislada, secretos administrados externamente y el seed demo deshabilitado en producción.
# Auditoría de roles y permisos

Fecha: 2026-07-16

## Causa raíz

El seed demo agregaba asociaciones `RolePermission` mediante `upsert`, pero no retiraba permisos que hubieran quedado asignados en ejecuciones o matrices anteriores. Como los guards consultan la base de datos, una asociación histórica como `SELLER -> branches.create` era considerada válida.

## Correcciones

- Se definió una matriz canónica para OWNER, ADMIN, CASHIER, SELLER, WAREHOUSE y ACCOUNTING.
- Se agregó el permiso real `roles.assign`.
- `/auth/me` filtra asociaciones incompatibles con el rol predefinido.
- El guard rechaza permisos incompatibles aunque exista una asociación histórica.
- El seed agrega la matriz vigente de forma idempotente. Las asociaciones históricas sobrantes quedan neutralizadas por backend sin ejecutar borrados.
- ADMIN no puede asignar, editar ni degradar OWNER.
- Se adoptó la política de OWNER único fundador.
- La UI de sucursales y usuarios oculta acciones según permisos efectivos y jerarquía.

## Resultado por rol

- OWNER: administración empresarial completa y backup.
- ADMIN: usuarios operativos, roles no OWNER, sucursales y operación diaria; sin backup completo.
- CASHIER: POS, ventas, caja y consulta operativa; sin administración empresarial.
- SELLER: POS, ventas y clientes básicos; sin administración de sucursales o usuarios.
- WAREHOUSE: catálogo operativo, inventario, importación y transferencias; sin usuarios o sucursales administrativas.
- ACCOUNTING: consulta financiera, administración del sandbox fiscal mock, reportes y exportaciones autorizadas; sin backup o administración empresarial.

## Endpoints sensibles

Se validaron especialmente `/branches`, `/branches/:id`, `/branches/:id/users`, `/users`, `/users/:id`, `/users/:id/status`, `/roles`, inventario, POS y reportes.

## Riesgos pendientes

- Los roles continúan siendo predefinidos; no existe editor de permisos personalizados.
- Cualquier futura ampliación del catálogo debe actualizar la matriz canónica y este documento.

## Sincronización de permisos RBAC para empresas existentes

Se detectó que empresas registradas antes de incorporar `roles.assign` podían conservar un ADMIN sin la asociación persistida necesaria. El seed demo no resolvía esas empresas porque solo procesa la compañía demo.

La matriz se centralizó en `apps/api/src/roles/company-role-permissions.json`. El registro de empresas, `/auth/me`, guards, seed y script de sincronización usan ahora la misma fuente.

Comando:

```powershell
$env:CONFIRM_SYNC_RBAC="true"; npm run rbac:sync-company-roles
```

Primera ejecución validada:

- 4 empresas procesadas.
- 24 roles procesados.
- 138 asociaciones faltantes agregadas.
- 14 asociaciones incompatibles detectadas y neutralizadas.
- 0 acciones destructivas.

La segunda ejecución agregó 0 permisos, confirmando idempotencia.

# QA — Branding & Product Media

## Cobertura

- Logo empresarial aislado por empresa, con carga, reemplazo, eliminación y vista previa.
- Logo en impresión de documentos internos, sujeto a `printLogo`.
- Disclaimer no fiscal conservado.
- Imagen opcional por URL o upload en productos.
- Miniaturas y placeholder en catálogo, POS y carrito.
- Validaciones de formato, tamaño y firma de archivos.

## Prueba manual recomendada

1. Como OWNER, abrir `/settings/business`, subir un PNG válido y activar **Imprimir logo**.
2. Crear una venta, generar un documento interno y comprobar el encabezado en `/internal-documents/{id}/print`.
3. Crear un producto con imagen subida, comprobar catálogo, búsqueda POS y carrito.
4. Crear otro producto sin imagen y comprobar el placeholder.
5. Intentar PDF, SVG, EXE, un PNG falso y una imagen superior al límite; todos deben rechazarse.
6. Iniciar sesión en otra empresa y confirmar que su branding y rutas son independientes.

## Límite conocido

El almacenamiento es local al nodo de API. Antes de desplegar múltiples instancias debe sustituirse por object storage compartido y respaldado. Esta fase no cambia DGII ni el flujo de facturación fiscal.
