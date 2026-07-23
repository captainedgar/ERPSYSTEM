# QA de Billing y PayPal Checkout

## Estado del flujo Sandbox

El flujo implementado crea una orden PayPal `CAPTURE`, redirige al comprador y, al regresar a `/settings/billing`, captura la orden desde el backend local. Esto permite probar localhost sin ngrok. El webhook permanece como respaldo para staging y producción.

Secuencia esperada:

1. El cliente solicita un cambio de plan.
2. Platform Admin aprueba y genera la factura.
3. La solicitud queda `APPROVED_PENDING_PAYMENT`.
4. `POST /company-billing/plan-change-requests/:id/checkout` crea el checkout.
5. PayPal regresa con `checkoutSessionId`.
6. `POST /company-billing/checkout-sessions/:id/capture` captura y aplica el pago.
7. Factura `PAID`, pago registrado, solicitud `APPROVED_APPLIED` y plan actualizado.

La captura y el webhook comparten la misma aplicación transaccional e idempotente. Una sesión `PAID` devuelve éxito sin volver a capturar.

## Configuración requerida

- `PAYPAL_ENV=sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_CHECKOUT_CURRENCY=USD`
- `PAYPAL_DOP_USD_RATE`
- `APP_PUBLIC_URL=http://localhost:3000`
- `API_PUBLIC_URL=http://localhost:3001`

`NEXT_PUBLIC_PAYPAL_CLIENT_ID` solo es necesario si alguna integración frontend usa el SDK JS; el flujo actual crea y captura órdenes exclusivamente desde el backend. `PAYPAL_WEBHOOK_ID` puede omitirse durante la prueba local por retorno, pero es obligatorio para staging y producción.

## Política DOP/USD

La factura permanece en DOP. Al crear el checkout, el backend divide el balance pendiente por `PAYPAL_DOP_USD_RATE`, redondea a dos decimales y congela importe, monedas, tasa, fuente y fecha en `PaymentCheckoutSession`. El frontend solo presenta esa política; no envía monto, moneda ni tasa como fuente de verdad.

## Casos exitosos

- Orden creada únicamente para una solicitud `APPROVED_PENDING_PAYMENT`.
- Captura `COMPLETED` registra `SubscriptionPayment`.
- Factura, solicitud y suscripción se actualizan en una transacción.
- Recargar el retorno no duplica el pago.
- Un webhook posterior no duplica el pago.
- Una captura posterior a un webhook confirmado devuelve éxito idempotente.

## Casos de error

- Configuración incompleta: `PAYMENT_PROVIDER_NOT_CONFIGURED` y alternativa de transferencia.
- Moneda/tasa inválida: `PAYMENT_CURRENCY_NOT_SUPPORTED`.
- Orden sin URL de aprobación: mensaje de soporte.
- Captura no confirmada: se conserva la solicitud pendiente y se indica reconciliación administrativa.
- Monto o moneda de PayPal diferente a la sesión: conflicto, sin aplicar plan.

## Solicitudes Platform

- **Activas:** `PENDING`, `APPROVED_PENDING_PAYMENT`, `PAYMENT_FAILED`.
- **Historial:** `APPROVED_APPLIED`, `REJECTED`, `CANCELLED`, `EXPIRED`.
- **Todas:** todos los estados.

Solo `SUPER_ADMIN` puede cancelar administrativamente una solicitud activa sin pago. El checkout y la factura pendientes se cancelan, se conserva la solicitud y se registra auditoría.

## Webhook en staging

Configurar una URL HTTPS pública hacia `POST /billing/webhooks/paypal`, registrar el Webhook ID y probar al menos `PAYMENT.CAPTURE.COMPLETED`, eventos duplicados y entrega posterior a la captura por retorno.

## Riesgos pendientes

La API no inicia con `NODE_ENV=staging` si falta `PAYPAL_WEBHOOK_ID`. Consulte
`docs/STAGING_DEPLOYMENT.md` para el runbook y checklist completo.

- La compra Sandbox completa requiere una cuenta Personal Sandbox interactiva.
- Staging necesita HTTPS y un Webhook ID real.
- La tasa manual debe tener propietario operativo, fecha de revisión y política de actualización.
- Los checkouts abandonados se conservan hasta su expiración/reconciliación.
