# Auditoría de facturación SaaS para clientes

Fecha: 2026-07-16

## Resumen ejecutivo

Antes de esta fase, la facturación SaaS solo era operable desde Platform Admin.
El cliente empresarial podía usar un link público si el equipo de plataforma se
lo compartía, pero no tenía endpoints autenticados, pantalla de suscripción ni
navegación propia.

Se implementó un módulo empresarial de solo consulta y acceso al flujo público
de reporte. Platform Admin conserva la autoridad para crear facturas, crear
links, registrar pagos, revisar reportes, cambiar planes y reactivar empresas.

## Estado previo

Existían planes, suscripciones, facturas y pagos manuales en Platform Admin,
links públicos y reportes manuales. No existían endpoints empresariales, ruta
`/settings/billing`, navegación propia ni infraestructura de tarjetas.

## Backend empresarial implementado

Todos los endpoints usan `companyId` de la sesión autenticada. No aceptan
`companyId` por query, path ni body.

| Endpoint | Permiso | Alcance |
| --- | --- | --- |
| `GET /company-billing/subscription` | `billing.view` | Plan, fechas y estado propios |
| `GET /company-billing/invoices` | `billing.invoices.view` | Facturas y link activo propio |
| `GET /company-billing/invoices/:id` | `billing.invoices.view` | Detalle propio |
| `GET /company-billing/payments` | `billing.payments.view` | Pagos confirmados propios |
| `GET /company-billing/events` | `billing.view` | Eventos propios |
| `POST /company-billing/invoices/:id/payment-link` | `billing.pay` | Recupera un link activo existente |

El endpoint de payment-link no genera un link nuevo porque el esquema exige
`createdByPlatformUserId`. Si no existe uno activo, solicita contactar al equipo
de facturación. No existe endpoint empresarial para marcar pagado, registrar
pagos, cambiar plan, cancelar links o reactivar la empresa.

## Frontend implementado

Se agregó `/settings/billing` y el enlace Configuración → Suscripción y pagos.
La pantalla muestra plan, estado, fechas, días restantes, precio, facturas,
balance, pagos, eventos, instrucciones y avisos de validación manual y documento
no fiscal.

La pantalla también consume `/company-billing/entitlements`, muestra uso contra
límites, features incluidas y permite registrar una solicitud de cambio de plan
sin aplicar cambios financieros automáticos.

## Permisos RBAC

- OWNER: consulta y pago.
- ADMIN: `billing.view`, `billing.pay`, `billing.invoices.view`,
  `billing.payments.view`.
- ACCOUNTING: consulta de suscripción, facturas y pagos.
- CASHIER, SELLER y WAREHOUSE: sin billing SaaS por defecto.

## Link público y reportes

El flujo público muestra factura, monto, balance e instrucciones y permite
reportar monto, persona, correo, referencia y notas. El reporte no marca la
factura como pagada ni reactiva la empresa.

## Empresa suspendida

El guard permite `/auth/me`, logout, refresh y `/company-billing/*`. La pantalla
`/suspended` incorpora el resumen de billing y acceso al link. POS, ventas y
otros módulos operativos permanecen bloqueados.

## Métodos de pago y tarjetas

No se encontró infraestructura para tarjetas tokenizadas, vault, cobro
automático, webhooks o reintentos. No se agregaron campos `cardNumber`, `cvv`,
`expiration`, `cardHolder` ni datos crudos de tarjeta.

## Riesgos y pendientes

- Workflow Platform explícito para aprobar o descartar reportes.
- Instrucciones bancarias configurables sin exponer información sensible.
- Paginación server-side.
- Notificaciones y expiración/rotación de links.

## Roadmap recomendado para pasarela real

1. Seleccionar proveedor con tokenización alojada.
2. Persistir solo identificadores tokenizados y metadatos no sensibles.
3. Usar componentes PCI del proveedor.
4. Verificar webhooks con firma, idempotencia y protección de replay.
5. Implementar conciliación, reintentos y auditoría.

## Confirmación de alcance

- No se implementó DGII real.
- No se implementó pasarela real.
- No se guardaron tarjetas.
- No se procesaron pagos reales.
- No se mezcló Platform Admin con la sesión empresarial.
- No se modificó el esquema Prisma.
- No se borraron datos ni se ejecutaron comandos destructivos.
# Flujo operativo de cambio de plan

`POST /company-billing/plan-change-request` registra una solicitud con estado
`PENDING` en el `AuditLog` empresarial. La metadata conserva plan actual, plan
solicitado, usuario y estado de revision. El plan y el precio no cambian desde
la sesion empresarial.

`GET /company-billing/plan-change-requests` permite al cliente consultar el
historial. Solo puede existir una solicitud pendiente por empresa. Platform
Admin puede aprobarla o rechazarla; el cliente ve `PENDING`, `APPROVED` o
`REJECTED` en `/settings/billing`.

# Metodos manuales

`GET /company-billing/payment-instructions` publica transferencia, deposito y
reporte por link publico. Son instrucciones de demo configuradas en codigo y no
contienen credenciales bancarias reales. Los reportes requieren validacion
manual.

Tarjetas permanecen marcadas como proximamente. No existen campos para numero
de tarjeta o CVV, tokenizacion, webhooks ni procesamiento automatico.
