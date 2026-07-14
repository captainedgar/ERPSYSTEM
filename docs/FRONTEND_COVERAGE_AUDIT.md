# Auditoria de cobertura Frontend vs Backend

## Resumen ejecutivo

Esta auditoria cruza los controllers de `apps/api/src`, las rutas reales de
`apps/web/app`, las librerias cliente de `apps/web/lib` y la navegacion visible
en `AppDashboardShell` y `PlatformShell`.

El producto tiene cobertura frontend amplia en las areas operativas principales:
auth, catalogo, clientes, POS, ventas, caja, inventario, documentos internos,
reportes, exportacion, dashboard financiero, platform admin y billing SaaS. Los
modulos recientes mas criticos tambien estan conectados: links publicos de pago,
compatibilidad de productos, inventario multi-sucursal, importacion Excel,
exportacion/backup y dashboard financiero.

Los hallazgos principales no son de backend ausente, sino de descubribilidad y
permisos UI: varias rutas existen pero no estan enlazadas directamente en el
sidebar; fiscal mock/e-CF tiene backend pero no tiene UI empresarial dedicada;
algunas pantallas protegen por rol hardcodeado en frontend en vez de permisos
reales; y algunas acciones backend existen en librerias pero no tienen boton o
vista completa.

## Estado general

| Modulo | Backend | Frontend | Navegacion | Estado | Prioridad |
|---|---|---|---|---|---|
| Auth empresa | OK | Login, registro, sesion, logout | Publica | OK | Baja |
| Empresas cliente | OK | Configuracion negocio, logo parcial | Dashboard enlaza configuracion | Parcial | Media |
| Usuarios y roles | OK | Sin UI empresarial dedicada | No visible | Falta UI | Alta |
| Sucursales | OK | Listar, crear, editar, activar/desactivar, principal | Sidebar a Sucursales | Parcial | Media |
| Catalogo base | OK | Productos, servicios, categorias, marcas, unidades | Sidebar solo a Catalogo/productos | Falta navegacion | Media |
| Productos | OK | CRUD, estado, importacion Excel enlazada desde ruta propia | Parcial | Parcial | Media |
| Clientes | OK | CRUD, estado | Sidebar | OK | Baja |
| POS | OK | Busqueda, scanner, validar carrito, venta, alternativas | Sidebar | OK | Baja |
| Ventas | OK | Lista, detalle, cancelar | Sidebar | OK | Baja |
| Caja | OK | Actual, abrir/cerrar, movimientos, sesiones | Sidebar; sesiones desde caja | OK | Baja |
| Documentos internos | OK | Lista, detalle, print, anular | Sidebar | OK | Baja |
| Fiscal mock/e-CF | OK | Sin pantallas empresa dedicadas | No visible | Falta UI | Alta |
| Reportes basicos | OK | Overview, ventas, caja, inventario, clientes, documentos | Sidebar solo a Reportes | Falta navegacion | Media |
| Importacion Excel | OK | Plantilla, preview, commit | No visible directo en sidebar | Falta navegacion | Media |
| Compatibilidad productos | OK | Crear grupos, asignar, codigos alternos, sustitutos, POS alternativas | No visible directo en sidebar | Falta navegacion | Media |
| Inventario multi-sucursal | OK | Inventario por sucursal activa, movimientos, bajo stock, transferencias | Sidebar solo a Inventario | Parcial | Media |
| Exportacion/backup | OK | Todos los cards incluyendo backup | Sidebar | OK | Baja |
| Dashboard financiero | OK | KPIs, filtros, scope, metodos, top, caja, inventario, alertas | Sidebar | OK | Baja |
| Platform Admin | OK | Dashboard, empresas, planes, billing, facturas, auditoria | Platform sidebar | OK | Baja |
| Billing SaaS | OK | Planes, suscripciones, pagos, facturas, links, print | Platform sidebar parcial | OK | Baja |
| Links publicos de pago | OK | `/pay/invoice/[token]`, reportar pago | Link externo, no requiere sidebar | OK | Baja |

## Endpoints backend agrupados por modulo

### Auth

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| POST `/auth/register-company` | Publico | Registrar empresa inicial | `/register` | OK |
| POST `/auth/login` | Publico | Login empresa | `/login` | OK |
| POST `/auth/refresh` | Token refresh | Renovar access token | `auth-provider`/`apiRequest` | OK |
| POST `/auth/logout` | Auth | Cerrar sesion | `auth-provider` | OK |
| GET `/auth/me` | Auth | Usuario actual seguro | `auth-provider` | OK |

### Empresas cliente

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/companies/me` | `companies.view` | Ver empresa actual | No uso directo encontrado | Parcial |
| PATCH `/companies/me` | `companies.update` | Actualizar empresa | Configuracion negocio parcial | Parcial |
| GET `/companies/me/logo` | Publico/control interno | Descargar logo | No vista dedicada | Parcial |
| POST `/companies/me/logo` | `companies.update` | Subir logo | Configuracion negocio si el form lo usa | Parcial |
| DELETE `/companies/me/logo` | `companies.update` | Quitar logo | No boton confirmado | Falta accion/boton |

### Usuarios y roles

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/roles` | `roles.view` | Listar roles | Usado en tests; no UI de usuarios | Falta UI |
| GET `/users` | `users.view` | Listar usuarios | No ruta empresarial | Falta UI |
| POST `/users` | `users.create` | Crear usuario | No ruta empresarial | Falta UI |
| GET `/users/:id` | `users.view` | Detalle usuario | No ruta empresarial | Falta UI |
| PATCH `/users/:id` | `users.update` | Editar usuario | No ruta empresarial | Falta UI |
| PATCH `/users/:id/status` | `users.disable` | Activar/desactivar usuario | No ruta empresarial | Falta UI |

### Sucursales

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/branches` | `branches.view` | Listar sucursales | `/settings/branches` | OK |
| GET `/branches/available` | `branches.view` | Selector de sucursal activa | Shell y transferencias | OK |
| POST `/branches` | `branches.create` | Crear sucursal | `/settings/branches/new` | OK |
| GET `/branches/:id` | `branches.view` | Detalle sucursal | `/settings/branches/[id]` | OK |
| PATCH `/branches/:id` | `branches.update` | Editar sucursal | `/settings/branches/[id]` | OK |
| PATCH `/branches/:id/status` | `branches.change_status` | Activar/desactivar | Lista y formulario | OK |
| PATCH `/branches/:id/main` | `branches.set_main` | Marcar principal | Lista y formulario | OK |
| GET `/branches/users/:id/branches` | `branches.assign_users` | Sucursales de usuario | No UI | Falta accion/boton |
| PUT `/branches/users/:id/branches` | `branches.assign_users` | Reasignar sucursales usuario | No UI | Falta accion/boton |
| GET `/branches/:id/users` | `branches.assign_users` | Usuarios por sucursal | Conteo en lista, no detalle | Parcial |
| POST `/branches/:id/users` | `branches.assign_users` | Asignar usuario | No UI | Falta accion/boton |
| DELETE `/branches/:id/users/:userId` | `branches.assign_users` | Remover usuario de sucursal | No UI | Falta accion/boton |

### Catalogo, productos, servicios, categorias, marcas y unidades

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET/POST/PATCH/PATCH status `/products` | `products.*` | CRUD/estado productos | `/catalog/products` | OK |
| GET/POST/PATCH/PATCH status `/services` | `services.*` | CRUD/estado servicios | `/catalog/services` | OK |
| GET/POST/PATCH/PATCH status `/categories` | `categories.*` | CRUD/estado categorias | `/catalog/categories` | OK |
| GET/POST/PATCH/PATCH status `/brands` | `brands.*` | CRUD/estado marcas | `/catalog/brands` | OK |
| GET/POST/PATCH/PATCH status `/units` | `units.*` | CRUD/estado unidades | `/catalog/units` | OK |
| GET `/products/import/template` | `products.import` | Descargar plantilla Excel | `/catalog/products/import` | OK |
| POST `/products/import/preview` | `products.import` | Preview importacion | `/catalog/products/import` | OK |
| POST `/products/import/commit` | `products.import` | Confirmar importacion | `/catalog/products/import` | OK |

### Compatibilidad de productos

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/product-compatibility/groups` | `product_compatibility.view` | Listar grupos | `/catalog/compatibility` | OK |
| POST `/product-compatibility/groups` | `product_compatibility.manage` | Crear grupo | `/catalog/compatibility` | OK |
| GET/PATCH/PATCH status `/product-compatibility/groups/:id` | View/manage | Detalle, editar, estado grupo | Sin vista de detalle/edicion completa | Parcial |
| POST `/product-compatibility/groups/:id/products` | `product_compatibility.manage` | Asignar producto | `/catalog/compatibility` | OK |
| DELETE `/product-compatibility/groups/:id/products/:productId` | `product_compatibility.manage` | Quitar producto | `/catalog/compatibility` | OK |
| GET `/products/:id/compatibility` | `product_compatibility.view` | Ver compatibilidad producto | `/catalog/compatibility` | OK |
| POST/DELETE `/products/:id/compatibility/groups` | `product_compatibility.manage` | Gestionar grupos desde producto | Parcial via pantalla | Parcial |
| GET/POST/DELETE `/products/:id/alternative-codes` | View/manage | Codigos OEM/alternos | `/catalog/compatibility` | OK |
| GET/POST/DELETE `/products/:id/substitutes` | View/manage | Sustitutos | `/catalog/compatibility` | OK |
| GET `/pos/items/:id/alternatives` | `pos.access` | Alternativas de item POS | POS | OK |
| GET `/pos/alternatives` | `pos.access` | Alternativas por busqueda POS | POS | OK |

### Inventario

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/inventory` | `inventory.view` | Stock por sucursal activa | `/inventory` | OK |
| GET `/inventory/low-stock` | `inventory.view_low_stock` | Bajo stock por sucursal | `/inventory/low-stock` | OK |
| GET `/inventory/products/:productId/movements` | `inventory.view_movements` | Movimientos producto | `/inventory/products/[id]/movements` | OK |
| GET `/inventory/products/:productId/stock-by-branch` | `inventory.view` | Stock por sucursal | Lib existe; no pantalla dedicada | Parcial |
| GET `/inventory/transfers` | `inventory.transfer` | Listar transferencias | `/inventory/transfers` | OK |
| GET `/inventory/transfers/:id` | `inventory.transfer` | Detalle transferencia | No ruta detalle | Falta UI |
| POST `/inventory/transfers` | `inventory.transfer` | Crear transferencia | `/inventory/transfers` | OK |
| POST `/inventory/products/:productId/manual-entry` | `inventory.adjust` | Entrada manual | `/inventory` | OK |
| POST `/inventory/products/:productId/adjust` | `inventory.adjust` | Ajuste +/- | `/inventory` | OK |

### POS y ventas

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/pos/search-items` | `pos.access` | Buscar productos/servicios/barcode | `/pos` | OK |
| POST `/pos/validate-cart` | `pos.validate_cart` | Validar carrito | `/pos` | OK |
| GET `/sales` | `sales.view` | Listar ventas | `/sales` | OK |
| POST `/sales` | `sales.create` | Crear venta | `/pos` | OK |
| GET `/sales/:id` | `sales.view_detail` | Detalle venta | `/sales/[id]` | OK |
| POST `/sales/:id/cancel` | `sales.cancel` | Cancelar venta | `/sales/[id]` | OK |

### Clientes

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/customers` | `customers.view` | Listar/buscar clientes | `/customers` | OK |
| POST `/customers` | `customers.create` | Crear cliente | `/customers` | OK |
| GET `/customers/:id` | `customers.view` | Detalle cliente | Pantalla embebida en manager | Parcial |
| PATCH `/customers/:id` | `customers.update` | Editar cliente | `/customers` | OK |
| PATCH `/customers/:id/status` | `customers.change_status` | Activar/desactivar | `/customers` | OK |

### Caja

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/cash/current` | `cash.view` | Caja abierta actual | `/cash` | OK |
| GET `/cash/sessions` | `cash.view_sessions` | Listar sesiones | `/cash/sessions` | OK |
| GET `/cash/sessions/:id` | `cash.view_sessions` | Detalle sesion | `/cash/sessions/[id]` | OK |
| POST `/cash/open` | `cash.open` | Abrir caja | `/cash` | OK |
| POST `/cash/close` | `cash.close` | Cerrar caja | `/cash` | OK |
| POST `/cash/movements/manual-in` | `cash.manual_movement` | Entrada manual | `/cash` | OK |
| POST `/cash/movements/manual-out` | `cash.manual_movement` | Salida manual | `/cash` | OK |

### Documentos internos

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/internal-documents` | `internal_documents.view` | Listar documentos | `/internal-documents` | OK |
| POST `/internal-documents/from-sale/:saleId` | `internal_documents.create` | Crear desde venta | Detalle de venta/documento | Parcial |
| GET `/internal-documents/:id` | `internal_documents.view` | Detalle | `/internal-documents/[id]` | OK |
| GET `/internal-documents/:id/print` | `internal_documents.print` | Datos impresion | `/internal-documents/[id]/print` | OK |
| POST `/internal-documents/:id/void` | `internal_documents.void` | Anular | `/internal-documents/[id]` | OK |
| GET `/sales/:saleId/internal-documents` | `internal_documents.view` | Docs de venta | Detalle venta | OK |

### Fiscal mock/e-CF

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET/PUT `/fiscal/settings` | `fiscal.settings.*` | Configuracion fiscal | Sin ruta `/fiscal` | Falta UI |
| GET `/fiscal/providers` | `fiscal.providers.view` | Listar proveedores | Sin ruta `/fiscal` | Falta UI |
| POST `/fiscal/providers/mock/enable` | `fiscal.providers.configure` | Activar proveedor mock | Sin ruta `/fiscal` | Falta UI |
| POST `/fiscal/providers/:providerId/test-connection` | `fiscal.providers.configure` | Probar conexion | Sin ruta `/fiscal` | Falta UI |
| POST `/fiscal/electronic-invoices/from-sale/:saleId` | `fiscal.documents.create` | Crear e-CF desde venta | No boton visible | Falta accion/boton |
| POST `/fiscal/electronic-invoices/from-internal-document/:internalDocumentId` | `fiscal.documents.create` | Crear e-CF desde doc interno | No boton visible | Falta accion/boton |
| GET `/fiscal/electronic-invoices` | `fiscal.documents.view` | Listar e-CF | Sin ruta | Falta UI |
| GET `/fiscal/electronic-invoices/:id` | `fiscal.documents.view` | Detalle e-CF | Sin ruta | Falta UI |
| POST `/fiscal/electronic-invoices/:id/send` | `fiscal.documents.send` | Enviar mock | Sin boton | Falta accion/boton |
| POST `/fiscal/electronic-invoices/:id/retry` | `fiscal.documents.retry` | Reintentar mock | Sin boton | Falta accion/boton |
| GET `/fiscal/electronic-invoices/:id/status` | `fiscal.documents.view` | Estado e-CF | Sin ruta | Falta UI |
| GET `/fiscal/electronic-invoices/:id/events` | `fiscal.documents.view_events` | Eventos | Sin ruta | Falta UI |
| GET `/fiscal/electronic-invoices/:id/errors` | `fiscal.documents.view_errors` | Errores | Platform solo muestra resumen | Parcial |

### Reportes basicos

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/reports/overview` | `reports.view` | Resumen | `/reports` | OK |
| GET `/reports/sales` | `reports.sales` | Ventas | `/reports/sales` | OK |
| GET `/reports/sales/by-day` | `reports.sales` | Ventas por dia | `/reports/sales` | OK |
| GET `/reports/sales/by-user` | `reports.sales` | Ventas por usuario | `/reports/sales` | OK |
| GET `/reports/sales/top-products` | `reports.sales` | Top productos | `/reports/sales` | OK |
| GET `/reports/cash` | `reports.cash` | Caja | `/reports/cash` | OK |
| GET `/reports/customers` | `reports.customers` | Clientes | `/reports/customers` | OK |
| GET `/reports/inventory/low-stock` | `reports.inventory` | Inventario bajo stock | `/reports/inventory` | OK |
| GET `/reports/documents` | `reports.documents` | Documentos | `/reports/documents` | OK |

### Exportacion y backup

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/data-export/products` | `data_export.products` | Exportar productos | `/data-export` | OK |
| GET `/data-export/inventory` | `data_export.inventory` | Exportar inventario | `/data-export` | OK |
| GET `/data-export/customers` | `data_export.customers` | Exportar clientes | `/data-export` | OK |
| GET `/data-export/sales` | `data_export.sales` | Exportar ventas | `/data-export` | OK |
| GET `/data-export/sales/items` | `data_export.sales` | Exportar detalle ventas | `/data-export` | OK |
| GET `/data-export/cash` | `data_export.cash` | Exportar caja | `/data-export` | OK |
| GET `/data-export/inventory-movements` | `data_export.inventory` | Exportar movimientos | `/data-export` | OK |
| GET `/data-export/inventory-transfers` | `data_export.inventory` | Exportar transferencias | `/data-export` | OK |
| GET `/data-export/internal-documents` | `data_export.documents` | Exportar documentos | `/data-export` | OK |
| GET `/data-export/reports/overview` | `data_export.view` | Exportar resumen | `/data-export` | OK |
| GET `/data-export/backup` | `data_export.full_backup` | Backup basico | `/data-export` | OK |

### Dashboard financiero

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| GET `/financial-dashboard/summary` | `financial_dashboard.view` | KPIs principales | `/financial-dashboard` | OK |
| GET `/financial-dashboard/sales-trend` | view + sales | Tendencia | `/financial-dashboard` | OK |
| GET `/financial-dashboard/payment-methods` | view + sales | Metodos de pago | `/financial-dashboard` | OK |
| GET `/financial-dashboard/branches` | view + branches | Sucursales | `/financial-dashboard` scope all | OK |
| GET `/financial-dashboard/top-products` | view + sales | Productos top | `/financial-dashboard` | OK |
| GET `/financial-dashboard/top-customers` | view + customers | Clientes top | `/financial-dashboard` | OK |
| GET `/financial-dashboard/cash-health` | view + cash | Caja | `/financial-dashboard` | OK |
| GET `/financial-dashboard/inventory-value` | view + inventory | Inventario valorizado | `/financial-dashboard` | OK |
| GET `/financial-dashboard/alerts` | view | Alertas | `/financial-dashboard` | OK |

### Platform Admin y Billing SaaS

| Endpoint | Permiso | Funcion | Frontend | Estado |
|---|---|---|---|---|
| POST `/platform/auth/login` | Publico platform | Login platform | `/platform/login` | OK |
| POST `/platform/auth/logout` | Platform auth | Logout | PlatformShell | OK |
| GET `/platform/auth/me` | Platform auth | Usuario platform | PlatformShell | OK |
| GET `/platform/metrics` | Platform auth | Dashboard platform | `/platform/dashboard` | OK |
| GET `/platform/audit-logs` | Platform auth | Auditoria | `/platform/audit` | OK |
| GET `/platform/companies` | Platform auth | Empresas | `/platform/companies` | OK |
| GET/PATCH `/platform/companies/:id/status` | Platform auth | Empresa y estado | `/platform/companies/[id]` | OK |
| GET `/platform/companies/:id/users` | Platform auth | Usuarios empresa | `/platform/companies/[id]` | OK |
| GET `/platform/companies/:id/metrics` | Platform auth | Metricas empresa | `/platform/companies/[id]` | OK |
| GET/POST/PATCH/PATCH status `/platform/plans` | Platform auth | Planes SaaS | `/platform/plans`, `/platform/plans/[id]` | OK |
| GET/PUT `/platform/companies/:companyId/subscription` | Platform auth | Suscripcion | `/platform/companies/[id]/subscription` | OK |
| POST/GET `/platform/companies/:companyId/subscription/payments` | Platform auth | Pagos manuales | Suscripcion | OK |
| GET `/platform/companies/:companyId/subscription/events` | Platform auth | Eventos suscripcion | Suscripcion | OK |
| GET `/platform/billing/payments` | Platform auth | Reporte pagos | `/platform/billing` | OK |
| GET `/platform/billing/subscriptions` | Platform auth | Suscripciones | `/platform/billing` | OK |
| GET/POST `/platform/billing/invoices` | Platform auth | Facturas SaaS | `/platform/billing/invoices` | OK |
| GET `/platform/billing/invoices/:id` | Platform auth | Detalle factura | `/platform/billing/invoices/[id]` | OK |
| GET/POST `/platform/billing/invoices/:id/payment-links` | Platform auth | Links de pago | Detalle factura | OK |
| POST `/platform/billing/payment-links/:id/cancel` | Platform auth | Cancelar link | Detalle factura | OK |
| POST `/platform/billing/invoices/:id/void` | Platform auth | Anular factura | Detalle factura | OK |
| POST `/platform/billing/invoices/:id/mark-overdue` | Platform auth | Marcar vencida | Lib existe; boton no confirmado | Parcial |
| GET `/platform/companies/:companyId/subscription/invoices` | Platform auth | Facturas por empresa | Suscripcion | OK |
| POST `/platform/billing/process-overdue` | Platform auth | Procesar mora | `/platform/billing` | OK |
| GET `/pay/invoice/:token` | Publico token | Ver factura publica | `/pay/invoice/[token]` | OK |
| POST `/pay/invoice/:token/report` | Publico token | Reportar pago | `/pay/invoice/[token]` | OK |

## Endpoints sin UI visible

| Endpoint | Funcion | Permiso | Estado | Recomendacion |
|---|---|---|---|---|
| `/users` CRUD | Gestion empresarial de usuarios | `users.*` | Falta UI | Crear pantalla `/settings/users` |
| `/branches/users/*` y `/branches/:id/users` | Asignar usuarios a sucursales | `branches.assign_users` | Falta accion/boton | Agregar panel en detalle de sucursal o usuarios |
| `/companies/me/logo` DELETE | Quitar logo empresa | `companies.update` | Falta accion/boton | Agregar accion en configuracion negocio |
| `/inventory/transfers/:id` | Detalle transferencia | `inventory.transfer` | Falta UI | Crear ruta `/inventory/transfers/[id]` |
| `/inventory/products/:productId/stock-by-branch` | Ver stock por sucursal | `inventory.view` | Parcial | Agregar modal/detalle desde inventario |
| `/product-compatibility/groups/:id` PATCH/status | Editar/desactivar grupo | `product_compatibility.manage` | Parcial | Agregar gestion de grupos |
| `/fiscal/settings` | Config fiscal mock | `fiscal.settings.*` | Falta UI | Crear `/fiscal/settings` |
| `/fiscal/providers*` | Proveedores mock/test | `fiscal.providers.*` | Falta UI | Crear panel proveedor mock |
| `/fiscal/electronic-invoices*` | Crear, enviar, retry, eventos, errores e-CF mock | `fiscal.documents.*` | Falta UI | Crear modulo `/fiscal/electronic-invoices` |
| `/platform/billing/invoices/:id/mark-overdue` | Marcar vencida | Platform auth | Parcial | Agregar boton controlado por estado |

## Rutas frontend existentes

| Ruta | Funcion | Componente | Lib API | En sidebar | Estado |
|---|---|---|---|---|---|
| `/` | Landing minima | app page | Ninguna | No aplica | OK |
| `/login` | Login empresa | page local | `apiRequest('/auth/login')` | Publica | OK |
| `/register` | Registro empresa | page local | `apiRequest('/auth/register-company')` | Publica | OK |
| `/dashboard` | Panel operativo | page local | `branches` | Si | OK |
| `/pos` | POS | `PosManager` | `pos`, `sales`, `product-compatibility` | Si | OK |
| `/sales` | Ventas | `SalesManager` | `sales` | Si | OK |
| `/sales/[id]` | Detalle/cancelacion | `SaleDetail` | `sales`, `internal-documents` | Desde ventas | OK |
| `/cash` | Caja actual | `CashManager` | `cash` | Si | OK |
| `/cash/sessions` | Sesiones caja | `CashSessionsManager` | `cash` | Desde caja | OK |
| `/cash/sessions/[id]` | Detalle sesion | `CashSessionDetail` | `cash` | Desde sesiones | OK |
| `/customers` | Clientes | `CustomersManager` | `customers` | Si | OK |
| `/catalog/products` | Productos | `CatalogManager` | `catalog` | Si, como Catalogo | OK |
| `/catalog/services` | Servicios | `CatalogManager` | `catalog` | No directo | Falta navegacion |
| `/catalog/categories` | Categorias | `CatalogManager` | `catalog` | No directo | Falta navegacion |
| `/catalog/brands` | Marcas | `CatalogManager` | `catalog` | No directo | Falta navegacion |
| `/catalog/units` | Unidades | `CatalogManager` | `catalog` | No directo | Falta navegacion |
| `/catalog/products/import` | Importacion Excel | `ProductsImportManager` | `products-import` | No directo | Falta navegacion |
| `/catalog/compatibility` | Compatibilidad | `ProductCompatibilityManager` | `product-compatibility` | No directo | Falta navegacion |
| `/inventory` | Inventario | `InventoryManager` | `inventory` | Si | OK |
| `/inventory/low-stock` | Bajo stock | `InventoryManager` | `inventory` | No directo | Falta navegacion |
| `/inventory/transfers` | Transferencias | `InventoryTransfersManager` | `inventory`, `branches`, `catalog` | No directo | Falta navegacion |
| `/inventory/products/[id]/movements` | Movimientos | `InventoryMovementsPage` | `inventory` | Desde producto | OK |
| `/internal-documents` | Docs internos | `InternalDocumentsManager` | `internal-documents` | Si | OK |
| `/internal-documents/[id]` | Detalle/anular | `InternalDocumentDetail` | `internal-documents` | Desde lista | OK |
| `/internal-documents/[id]/print` | Impresion | `InternalDocumentPrint` | `internal-documents` | Desde detalle | OK |
| `/reports` | Reporte overview | `ReportsDashboard` | `reports` | Si | OK |
| `/reports/sales` | Reporte ventas | `ReportsDashboard` | `reports` | No directo | Falta navegacion |
| `/reports/cash` | Reporte caja | `ReportsDashboard` | `reports` | No directo | Falta navegacion |
| `/reports/inventory` | Reporte inventario | `ReportsDashboard` | `reports` | No directo | Falta navegacion |
| `/reports/customers` | Reporte clientes | `ReportsDashboard` | `reports` | No directo | Falta navegacion |
| `/reports/documents` | Reporte documentos | `ReportsDashboard` | `reports` | No directo | Falta navegacion |
| `/data-export` | Exportacion y backup | `DataExportManager` | `data-export` | Si | OK |
| `/financial-dashboard` | Dashboard financiero | `FinancialDashboardManager` | `financial-dashboard` | Si | OK |
| `/settings/business` | Config negocio | `BusinessSettingsForm` | `business-settings` | Si | OK |
| `/settings/branches` | Sucursales | `BranchesList` | `branches` | Si | OK |
| `/settings/branches/new` | Nueva sucursal | `BranchFormPage` | `branches` | Desde sucursales | OK |
| `/settings/branches/[id]` | Editar sucursal | `BranchFormPage` | `branches` | Desde sucursales | OK |
| `/pay/invoice/[token]` | Pago publico SaaS | page local | `platform` public link APIs | Link externo | OK |
| `/platform/login` | Login platform | page local | `platformLogin` | Publica platform | OK |
| `/platform/dashboard` | Dashboard platform | page local | `platform` | Si platform | OK |
| `/platform/companies` | Empresas | page local | `platform` | Si platform | OK |
| `/platform/companies/[id]` | Empresa detalle | page local | `platform` | Desde empresas | OK |
| `/platform/companies/[id]/subscription` | Suscripcion | page local | `platform` | Desde empresa/billing | OK |
| `/platform/plans` | Planes | page local | `platform` | Si platform | OK |
| `/platform/plans/[id]` | Plan detalle | page local | `platform` | Desde planes | OK |
| `/platform/billing` | Billing overview | page local | `platform` | Si platform | OK |
| `/platform/billing/invoices` | Facturas SaaS | page local | `platform` | Si platform | OK |
| `/platform/billing/invoices/[id]` | Factura SaaS detalle/links | page local | `platform` | Desde facturas | OK |
| `/platform/billing/invoices/[id]/print` | Impresion SaaS | page local | `platform` | Desde detalle | OK |
| `/platform/audit` | Auditoria platform | page local | `platform` | Si platform | OK |
| `/suspended` | Empresa suspendida | page local | auth | No aplica | OK |
| `/onboarding/business` | Onboarding config | `BusinessSettingsForm` | `business-settings` | No aplica | OK |

## Acciones faltantes por pantalla

| Pantalla | Accion faltante | Endpoint relacionado | Prioridad |
|---|---|---|---|
| Sidebar empresa | Links directos a Servicios/Categorias/Marcas/Unidades/Compatibilidad/Importar | Rutas existentes | Media |
| Sidebar empresa | Links directos a Bajo stock/Transferencias | Rutas existentes | Media |
| Sidebar empresa | Link Fiscal mock/e-CF | `/fiscal/*` | Alta |
| Sidebar empresa | Link Gestion de usuarios | `/users`, `/roles` | Alta |
| Sucursales | Asignar/remover usuarios por sucursal | `/branches/:id/users` | Alta |
| Inventario | Modal o pagina de stock por sucursal | `/inventory/products/:productId/stock-by-branch` | Media |
| Inventario transferencias | Detalle transferencia | `/inventory/transfers/:id` | Media |
| Compatibilidad | Editar/desactivar grupo de compatibilidad | `/product-compatibility/groups/:id` | Media |
| Fiscal | Configurar proveedor mock, crear/enviar/reintentar e-CF, eventos/errores | `/fiscal/*` | Alta |
| Empresa/configuracion | Quitar logo | `DELETE /companies/me/logo` | Baja |
| Platform factura | Marcar vencida manualmente si aplica | `/platform/billing/invoices/:id/mark-overdue` | Baja |

## Problemas de navegacion

- El sidebar empresarial solo muestra un enlace general a Catalogo
  (`/catalog/products`), pero existen rutas reales para servicios, categorias,
  marcas, unidades, compatibilidad e importacion.
- El sidebar empresarial solo muestra Inventario, pero bajo stock,
  transferencias y movimientos quedan como rutas secundarias.
- Reportes tiene subrutas reales, pero el sidebar solo enlaza overview.
- `dashboardPrefixes` incluye `/fiscal`, pero no hay ruta `apps/web/app/fiscal`.
  Esto sugiere una navegacion futura no implementada.
- Platform Admin cubre Dashboard, Empresas, Planes, Billing, Facturas y
  Auditoria. No hay link separado a "Reportes de pago", aunque esta informacion
  aparece dentro de Billing.
- Links publicos SaaS no necesitan sidebar, pero dependen de que el admin copie
  el link desde detalle de factura; eso si existe.

## Problemas de permisos

- Muchas pantallas empresariales usan chequeos por `user.role.code` en frontend
  en vez de usar permisos reales. Ejemplos: POS, caja, ventas, clientes,
  documentos internos. Esto puede desalinearse con permisos personalizados.
- Algunas pantallas no aplican guardias finas antes de mostrar acciones; dejan
  que el backend responda 403. Ejemplos potenciales: exportacion, inventario,
  compatibilidad e importacion Excel.
- `AppDashboardShell` muestra enlaces globales sin filtrar por permisos. Un rol
  sin permiso puede ver rutas y luego recibir bloqueo/error dentro de pantalla.
- `DataExportManager` muestra todos los cards incluso si el rol no tiene cada
  permiso especifico de exportacion.
- `FinancialDashboardManager` muestra todos los paneles; si un rol tiene
  `financial_dashboard.view` pero no `sales/cash/inventory/customers`, las
  llamadas parciales pueden fallar y mostrar error global. Conviene degradar por
  permiso/panel.
- `PlatformShell` no filtra navegacion por rol platform (`SUPER_ADMIN`,
  `SUPPORT_ADMIN`, `BILLING_ADMIN`, `AUDITOR`); depende del backend/token para
  enforcement.

## Funciones criticas no visibles

1. Gestion empresarial de usuarios y roles.
2. Fiscal mock/e-CF empresarial completo.
3. Asignacion de usuarios a sucursales.
4. Stock por sucursal visible desde inventario.
5. Detalle de transferencias de inventario.
6. Navegacion directa a importacion Excel y compatibilidad.
7. Navegacion directa a subreportes.

## Revision de modulos recientes

### Payment links SaaS

- Generar link: visible en `/platform/billing/invoices/[id]`.
- Copiar link: visible con `navigator.clipboard`.
- Cancelar link: visible en detalle de factura.
- Ver reportes de pago: visible como resumen de reportes por link en detalle.
- Vista publica `/pay/invoice/[token]`: existe.
- Reportar pago publico: existe.
- Estado: OK.

### Compatibilidad de productos

- Crear grupo: visible.
- Asignar producto a grupo: visible.
- Agregar codigos alternos/OEM: visible.
- Agregar sustitutos: visible.
- Ver alternativas en POS: visible.
- Editar/desactivar grupo: endpoint existe, UI parcial.
- Estado: Parcial por navegacion y gestion de grupos.

### Inventario por sucursal

- Stock por sucursal activa: visible en inventario.
- Entrada manual por sucursal: visible y depende de sucursal activa.
- Ajuste por sucursal: visible y depende de sucursal activa.
- Transferencias: visible en ruta, enlazada desde inventario pero no sidebar.
- Bajo stock por sucursal: visible en ruta, no sidebar directo.
- Movimientos por sucursal/producto: visible desde inventario.
- Stock por todas las sucursales: endpoint/lib existe, UI parcial.
- Estado: Parcial.

### Exportacion / backup

- Productos, inventario, clientes, ventas, detalle de ventas, caja,
  movimientos, transferencias, documentos, resumen y backup: visibles.
- Riesgo: cards no parecen filtrarse por permiso especifico.
- Estado: OK funcional, riesgo menor de permisos UI.

### Dashboard financiero

- KPIs, filtros fecha, scope active/all, metodos de pago, sucursales, top
  productos/clientes, caja, inventario valorizado y alertas: visibles.
- Riesgo: paneles no parecen ocultarse por permiso granular.
- Estado: OK funcional, riesgo menor de permisos UI.

## Quick wins

- Agregar sublinks en sidebar para rutas ya existentes: servicios, categorias,
  marcas, unidades, compatibilidad, importar productos, bajo stock,
  transferencias y subreportes.
- Agregar acceso visible a `/catalog/products/import` desde productos si no esta
  suficientemente destacado.
- Agregar acceso visible a `/catalog/compatibility` desde productos/catalogo.
- Mostrar/ocultar cards de exportacion segun permisos.
- Mostrar/ocultar paneles del dashboard financiero segun permisos granulares.
- Crear boton "Ver stock por sucursal" en cada producto de inventario usando la
  lib existente.

## Prioridad Alta

- Crear UI de usuarios/roles empresariales.
- Crear UI Fiscal mock/e-CF empresarial.
- Conectar asignacion de usuarios a sucursales.
- Revisar control de permisos UI basado en permisos reales, no solo rol.

## Prioridad Media

- Mejorar navegacion a submodulos existentes.
- Crear detalle de transferencias.
- Completar gestion de grupos de compatibilidad.
- Agregar vista stock por sucursal.
- Agregar navegacion directa a subreportes.

## Prioridad Baja

- Quitar logo empresa.
- Boton manual "marcar vencida" en factura SaaS si se quiere exponer.
- Mejoras de UX en Platform para reportes de pago separados.

## Recomendacion de siguiente fase

Proponer la siguiente fase:

**Fase UI Coverage Fix - Conectar funciones faltantes al frontend**

Alcance recomendado:

1. Navegacion y descubribilidad de rutas ya existentes.
2. UI usuarios/roles y asignacion a sucursales.
3. UI fiscal mock/e-CF.
4. Acciones faltantes de inventario y compatibilidad.
5. Permisos UI granulares.

No se recomienda modificar logica de negocio ni base de datos para esa fase
salvo que durante el diseno se detecte una brecha real.

## Confirmacion de alcance de esta auditoria

- No se implementaron nuevas funcionalidades.
- No se borro codigo.
- No se cambiaron migraciones ni schema Prisma.
- No se cambio logica de negocio.
- No se ejecutaron comandos destructivos de Git.
