# Auditoria Platform Admin

## Resumen ejecutivo

Platform Admin utiliza autenticacion y sesion separadas de la sesion empresarial.
El backend ya cubre empresas, metricas, planes, suscripciones, pagos manuales,
facturas internas SaaS, links publicos, reportes de pago, vencimientos y
auditoria. La interfaz cubria casi todo, pero Pagos no tenia ruta dedicada, la
navegacion no estaba agrupada y la auditoria no tenia filtros.

Esta fase agrega esos puntos, mejora el dashboard con indicadores de cobro,
conecta el detalle de empresa con facturas y pagos, confirma la ejecucion de
vencimientos y alinea la visibilidad de acciones sensibles con los roles.

## Matriz backend y frontend

| Modulo | Endpoint | Pantalla esperada | UI | Navegacion | Rol | Accion |
|---|---|---|---|---|---|---|
| Auth | `POST /platform/auth/login` | `/platform/login` | Si | Publica | Todos | Sin cambio |
| Auth | `POST /platform/auth/logout` | Shell Platform | Si | Header | Autenticado | Sin cambio |
| Auth | `GET /platform/auth/me` | Shell Platform | Si | Global | Autenticado | Usado para rol y sesion |
| Metricas | `GET /platform/metrics` | `/platform/dashboard` | Si | Inicio | Todos | Complementado con billing |
| Empresas | `GET /platform/companies` | `/platform/companies` | Si | Clientes SaaS | Todos | Sin cambio |
| Empresas | `GET /platform/companies/:id` | `/platform/companies/[id]` | Si | Desde empresas | Todos | Enlaces operativos agregados |
| Empresas | `PATCH /platform/companies/:id/status` | Detalle empresa | Si | Contextual | SUPER_ADMIN | Accion visible solo al rol |
| Empresas | `GET /platform/companies/:id/users` | Detalle empresa | Si | Contextual | Todos | Sin cambio |
| Empresas | `GET /platform/companies/:id/metrics` | Detalle empresa | Si | Contextual | Todos | Sin cambio |
| Planes | `GET /platform/plans` | `/platform/plans` | Si | Facturacion | SUPER_ADMIN, BILLING_ADMIN, AUDITOR | Sin cambio |
| Planes | `POST /platform/plans` | `/platform/plans` | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Formulario oculto a solo lectura |
| Planes | `GET /platform/plans/:id` | `/platform/plans/[id]` | Si | Desde planes | Roles billing/auditoria | Sin cambio |
| Planes | `PATCH /platform/plans/:id` | Detalle plan | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Planes | `PATCH /platform/plans/:id/status` | Detalle plan | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Suscripciones | `GET /platform/companies/:companyId/subscription` | Detalle/suscripcion | Si | Contextual | Todos | Sin cambio |
| Suscripciones | `PUT /platform/companies/:companyId/subscription` | Suscripcion | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Pagos | `POST /platform/companies/:companyId/subscription/payments` | Suscripcion/factura | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Pagos | `GET /platform/companies/:companyId/subscription/payments` | Suscripcion | Si | Contextual | Todos | Sin cambio |
| Eventos | `GET /platform/companies/:companyId/subscription/events` | Suscripcion | Si | Contextual | Todos | Sin cambio |
| Facturas | `GET /platform/companies/:companyId/subscription/invoices` | Suscripcion | Si | Contextual | Todos | Sin cambio |
| Pagos | `GET /platform/billing/payments` | `/platform/billing/payments` | Si | Facturacion | Billing/auditoria | Ruta agregada |
| Suscripciones | `GET /platform/billing/subscriptions` | `/platform/billing` | Si | Clientes SaaS | Todos | Sin cambio |
| Facturas | `GET /platform/billing/invoices` | `/platform/billing/invoices` | Si | Facturacion | Billing/auditoria | Filtro por empresa agregado |
| Facturas | `POST /platform/billing/invoices` | Lista de facturas | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Formulario oculto a solo lectura |
| Facturas | `GET /platform/billing/invoices/:id` | Detalle factura | Si | Desde facturas | Billing/auditoria | Sin cambio |
| Links | `GET /platform/billing/invoices/:id/payment-links` | Detalle factura | Si | Contextual | Billing/auditoria | Incluye reportes |
| Links | `POST /platform/billing/invoices/:id/payment-links` | Detalle factura | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Links | `POST /platform/billing/payment-links/:id/cancel` | Detalle factura | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Facturas | `POST /platform/billing/invoices/:id/void` | Detalle factura | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Facturas | `POST /platform/billing/invoices/:id/mark-overdue` | Detalle factura | Si | Contextual | SUPER_ADMIN, BILLING_ADMIN | Backend protegido |
| Vencimientos | `POST /platform/billing/process-overdue` | `/platform/billing` | Si | Operacion contextual | SUPER_ADMIN, BILLING_ADMIN | Confirmacion y resumen |
| Auditoria | `GET /platform/audit-logs` | `/platform/audit` | Si | Operacion | Todos | Filtros locales agregados |
| Publico | `GET /pay/invoice/:token` | `/pay/invoice/[token]` | Si | Link publico | Publico | Sin cambio |
| Publico | `POST /pay/invoice/:token/report` | Link publico | Si | Contextual | Publico | Sin cambio |

## Rutas frontend

Existentes y auditadas:

- `/platform/login`
- `/platform/dashboard`
- `/platform/companies`
- `/platform/companies/[id]`
- `/platform/companies/[id]/subscription`
- `/platform/plans`
- `/platform/plans/[id]`
- `/platform/billing`
- `/platform/billing/invoices`
- `/platform/billing/invoices/[id]`
- `/platform/billing/invoices/[id]/print`
- `/platform/audit`
- `/pay/invoice/[token]`

Agregada:

- `/platform/billing/payments`

## Acciones agregadas

- Menu agrupado en Inicio, Clientes SaaS, Facturacion SaaS y Operacion.
- Pantalla global de pagos con busqueda, filtro por metodo, total y enlaces.
- Dashboard con MRR estimado, alertas de cobro, facturas pendientes, balance y
  pagos recientes.
- Enlaces desde empresa a suscripcion, facturas y pagos filtrados.
- Filtros de auditoria por fecha, accion, entidad/empresa y usuario Platform.
- Confirmacion antes de procesar vencimientos y resumen posterior.
- Boton de vencimientos visible solo para roles de billing.
- Suspender/reactivar visible solo para SUPER_ADMIN.
- Formularios de creacion de plan y factura ocultos a roles de solo lectura.

## Matriz de roles Platform

| Capacidad | SUPER_ADMIN | BILLING_ADMIN | SUPPORT_ADMIN | AUDITOR |
|---|---:|---:|---:|---:|
| Dashboard | Si | Si | Si | Si |
| Ver empresas, usuarios y metricas | Si | Si | Si | Si |
| Suspender/reactivar empresa manualmente | Si | No | No | No |
| Ver suscripciones | Si | Si | Si | Si |
| Gestionar planes y suscripciones | Si | Si | No | No |
| Registrar pagos y gestionar facturas/links | Si | Si | No | No |
| Procesar vencidos | Si | Si | No | No |
| Ver auditoria y reportes | Si | Si | Si | Si |

Las mutaciones criticas estan protegidas en backend por
`requireBillingAdmin` o por comprobacion explicita de `SUPER_ADMIN`; ocultar
controles en frontend es una mejora de UX, no la barrera de seguridad.

## Checklist de prueba

- [ ] Login Platform con `admin@platform.local`.
- [ ] Dashboard muestra KPIs operativos y de billing.
- [ ] Empresas abre lista y detalle.
- [ ] Detalle muestra metricas, usuarios y suscripcion.
- [ ] Enlaces de facturas y pagos filtran por empresa.
- [ ] Planes permite crear/editar con rol autorizado.
- [ ] Billing agrupa estados y muestra pagos recientes.
- [ ] Procesar vencidos pide confirmacion y presenta resumen.
- [ ] Facturas permite crear, abrir, imprimir, anular y marcar vencida.
- [ ] Detalle permite registrar pago y gestionar links.
- [ ] Link publico permite reportar pago.
- [ ] Reportes aparecen dentro del link en detalle de factura.
- [ ] Auditoria filtra sin mostrar secretos.
- [ ] No aparece shell empresarial ni selector de sucursal.
- [ ] AUDITOR no puede ejecutar mutaciones.
- [ ] SUPPORT_ADMIN no puede cambiar billing critico.

## Pendientes y recomendaciones futuras

No implementados por estar fuera de esta fase:

- Filtros server-side y paginacion para auditoria, pagos y facturas.
- Notas internas, historial comercial y contactos de facturacion.
- Adjuntos de comprobantes.
- Envio de facturas y alertas por email.
- Pasarela real y webhooks.
- Modo soporte/impersonacion con controles y auditoria estrictos.
- Limites efectivos por plan.
- MRR/ARR, churn y cohortes avanzados.
- Pagina comercial publica.

Platform Admin puede editar precio, ciclo, usuarios, sucursales, `maxProducts`
en `modules` y revisar las features configuradas. La matriz estándar y el flujo
de entitlements están documentados en `docs/SAAS_PLANS.md`.

## Alcance y seguridad

- No se implemento DGII real.
- No se implemento pasarela real.
- No se creo impersonacion.
- No se mezclaron sesiones Platform y empresariales.
- No se modifico el esquema de base de datos.
- No se borraron datos ni se ejecutaron comandos destructivos.
