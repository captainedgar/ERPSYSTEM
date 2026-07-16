# Planes SaaS y entitlements

Fecha: 2026-07-16

## Fuente de verdad

La matriz canónica está en
`apps/api/src/company-entitlements/saas-plan-entitlements.ts`. El modelo
`SaasPlan` ya dispone de `maxUsers`, `maxBranches` y `modules` JSON, por lo que
no fue necesario modificar Prisma. `maxProducts`, el código estable y las
features se almacenan dentro de `modules`.

## Planes estándar

| Plan | Sucursales | Usuarios | Productos | Precio inicial |
| --- | ---: | ---: | ---: | ---: |
| Básico | 1 | 3 | 500 | RD$1,000/mes |
| Pro | 3 | 10 | 5,000 | RD$2,500/mes |
| Premium | 10 | 30 | 20,000 | RD$5,000/mes |
| Enterprise | Personalizado | Personalizado | Personalizado | Contactar ventas |

Los precios son configurables por Platform Admin y pueden ajustarse después.

### Básico

Incluye POS, ventas, caja, clientes, inventario y reportes básicos. No incluye
multi-sucursal, transferencias, importación Excel, compatibilidad, fiscal mock,
backup completo ni dashboard financiero avanzado.

### Pro

Agrega multi-sucursal, transferencias, importación Excel, exportaciones básicas,
dashboard financiero y reportes avanzados.

### Premium

Agrega compatibilidades, sustitutos, códigos alternos/OEM, fiscal mock,
exportaciones completas, backup XLSX y soporte prioritario.

### Enterprise

Incluye las features disponibles con límites y configuración comercial
personalizados.

## Registro

`GET /auth/registration-plans` publica el catálogo informativo. El registro
acepta únicamente `planCode`; nunca acepta precio ni usa un `planId` enviado por
el cliente.

- Sin `planCode`: Básico.
- Básico, Pro y Premium: prueba inicial de 14 días, estado `TRIAL`.
- Enterprise: estado inicial `PAYMENT_DUE` y revisión comercial.
- Un plan inactivo es rechazado.

El backend crea empresa, sucursal principal, OWNER y suscripción en una misma
transacción.

## Límites backend

Se validan antes de crear:

- `POST /branches`: `maxBranches`.
- `POST /users`: `maxUsers`, contando el OWNER.
- `POST /products`: `maxProducts`.
- Importación Excel: cupo total de productos del archivo.

Se aplican feature gates a:

- Importación Excel: `product_import`.
- Transferencias: `inventory_transfers`.
- Compatibilidad: `product_compatibility`.
- Backup XLSX: `backup_xlsx`.
- Fiscal mock: `fiscal_mock`.
- Dashboard financiero: `financial_dashboard`.

RBAC y entitlements son controles independientes: el usuario necesita permiso y
la empresa necesita la feature.

## Consulta y cambio de plan

`GET /company-billing/entitlements` devuelve plan, estado, límites, uso y
features. `/settings/billing` presenta esa información.

`POST /company-billing/plan-change-request` registra una solicitud auditada. No
cambia el plan, precio, factura ni estado de pago. Platform Admin sigue siendo
la autoridad para aprobar y asignar el plan.

## Suspensión y gracia

En `GRACE_PERIOD` la empresa puede operar y recibe una alerta con la fecha
límite. En `SUSPENDED`, los módulos operativos permanecen bloqueados y solo se
permiten autenticación y consulta/pago de billing.

## Métodos de pago

Actualmente existen transferencia o depósito manual, links públicos y reportes
de pago. No existen tarjetas, tokenización, cobro automático ni webhooks.
