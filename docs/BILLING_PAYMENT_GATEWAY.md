# Billing y PayPal Checkout

## Flujo

`PENDING` → Platform Admin aprueba → se crea factura → `APPROVED_PENDING_PAYMENT` → cliente abre PayPal hosted → webhook firmado confirma la captura → pago y factura se actualizan → suscripción cambia de plan → `APPROVED_APPLIED`.

El importe y la moneda salen exclusivamente de `SubscriptionInvoice.balance`. El frontend no envía importes. `PaymentWebhookEvent` tiene unicidad por proveedor y evento para impedir doble procesamiento.

## Configuración sandbox

Configure `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, `PAYPAL_WEBHOOK_ID`, `APP_PUBLIC_URL` y `API_PUBLIC_URL`. Registre en PayPal el webhook `POST {API_PUBLIC_URL}/billing/webhooks/paypal` y el evento `PAYMENT.CAPTURE.COMPLETED`.

Sin credenciales, el backend responde “Pago online no configurado” y los métodos manuales continúan disponibles. Platform Admin solo muestra indicadores de configuración, nunca secretos.

## Seguridad

El checkout se aloja en PayPal. Comercia ERP no incluye inputs de PAN/CVV, no almacena números de tarjeta, no almacena CVV y no procesa tarjetas directamente. Cada factura y solicitud se filtra por el `companyId` derivado de la sesión. La firma se verifica con la API oficial de PayPal antes de registrar el evento.

## Prueba local

1. Aplique la migración y migre solicitudes antiguas.
2. Solicite un cambio como OWNER/ADMIN con `billing.pay`.
3. Apruebe como SUPER_ADMIN o BILLING_ADMIN.
4. Pulse “Pagar ahora” y complete el checkout sandbox.
5. Verifique factura `PAID`, checkout `PAID`, solicitud `APPROVED_APPLIED` y el nuevo `planId`.

## Limitaciones MVP

- No hay formulario propio ni vault de tarjetas.
- No se captura una orden desde la URL de retorno; la fuente de verdad es el webhook.
- La cuenta PayPal debe aceptar la moneda configurada en la factura. Si PayPal no admite esa moneda para la cuenta, el checkout será rechazado y se requiere una estrategia explícita de conversión antes de producción.
- El pago manual por transferencia, depósito y reporte público sigue coexistiendo.
- No se implementó facturación electrónica ni integración DGII real.
