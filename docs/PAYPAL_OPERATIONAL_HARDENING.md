# PayPal operational hardening

## Scope

PayPal Live is disabled in this phase. `PAYPAL_ENV=live` does not enable online payments; the backend reports Sandbox and keeps PayPal unavailable until Sandbox configuration is valid.

The commercial and accounting invoice remains in DOP. PayPal charges the equivalent amount in USD.

## DOP/USD traceability

Each checkout freezes these values when the PayPal order is created:

- `invoiceAmount`
- `invoiceCurrency=DOP`
- `providerAmount`
- `providerCurrency=USD`
- `exchangeRate`
- `exchangeRateSource=MANUAL_ENV`
- `exchangeRateCapturedAt`

`PAYPAL_DOP_USD_RATE` must be positive and updated administratively before operating Sandbox. Changing the environment variable later does not modify an existing checkout session.

## Covered PayPal events

The implemented events are official PayPal webhook names:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- `CHECKOUT.PAYMENT-APPROVAL.REVERSED`

`PAYMENT.CAPTURE.COMPLETED` confirms the capture, creates one `SubscriptionPayment` per `providerCaptureId`, marks the invoice and checkout as paid, and applies an approved plan change once.

Denied, refunded and reversed captures register administrative alerts. Refunds and reversals do not automatically revert the subscription in this phase; subscription review remains a manual audited action.

The browser return (`?paypal=return` or `?paypal=cancel`) never confirms payment. It only informs the customer and waits for an authentic idempotent webhook.

## Idempotency

- `PaymentWebhookEvent` is unique by `provider + eventId`.
- `SubscriptionPayment.providerCaptureId` is unique.
- Plan application requires `APPROVED_PENDING_PAYMENT`.
- Already paid invoices and already applied requests block re-application.
- Webhook retries with the same event ID return duplicate without creating payments.

## Provider connection test

`POST /platform/billing/payment-providers/paypal/test-connection` is available only to `SUPER_ADMIN`.

It runs OAuth against PayPal Sandbox from the backend, creates no orders, captures no payments and returns only:

- `configured`
- `reachable`
- `environment`
- `testedAt`
- sanitized `error`

The action is audited without secrets.

## Safe reconciliation

`POST /platform/billing/payment-providers/paypal/reconcile` is available only to `SUPER_ADMIN`.

It expires local `PENDING` checkout sessions whose `expiresAt` is in the past. It does not call Live, create orders or capture payments.

## Sandbox checklist

1. Set `PAYPAL_ENV=sandbox`.
2. Configure `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID` in the environment secret manager.
3. Configure public `APP_PUBLIC_URL` and `API_PUBLIC_URL`.
4. Set `PAYPAL_CHECKOUT_CURRENCY=USD`.
5. Update `PAYPAL_DOP_USD_RATE` with the approved administrative rate.
6. Register webhook `POST {API_PUBLIC_URL}/billing/webhooks/paypal`.
7. Subscribe the covered PayPal events listed above.
8. Log in as `SUPER_ADMIN` and run "Probar conexion PayPal".
9. Approve a plan change request.
10. Pay using a PayPal Sandbox buyer account.
11. Verify invoice `PAID`, checkout `PAID`, one payment with `providerCaptureId`, request `APPROVED_APPLIED` and subscription event.
12. Test buyer cancellation and verify that no payment or plan change is applied.
