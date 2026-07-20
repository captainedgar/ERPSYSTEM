import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CompanyStatus,
  CompanySubscriptionStatus,
  PaymentCheckoutStatus,
  PaymentProvider,
  PaymentWebhookStatus,
  Prisma,
  SubscriptionEventType,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentMethod,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    amount?: { currency_code?: string; value?: string };
  };
};

type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
  links?: Array<{ rel: string; href: string }>;
};

type CheckoutWithRelations = Prisma.PaymentCheckoutSessionGetPayload<{
  include: { invoice: true; planChangeRequest: true };
}>;

const SUPPORTED_PAYPAL_CURRENCIES = [
  'AUD',
  'BRL',
  'CAD',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'HKD',
  'HUF',
  'ILS',
  'JPY',
  'MYR',
  'MXN',
  'TWD',
  'NZD',
  'NOK',
  'PHP',
  'PLN',
  'GBP',
  'SGD',
  'SEK',
  'CHF',
  'THB',
  'USD',
] as const;

const PAYPAL_EVENTS = [
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
] as const;

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly prisma: PrismaService) {}

  configuration() {
    const checkoutCurrency = (
      process.env.PAYPAL_CHECKOUT_CURRENCY ?? 'DOP'
    ).toUpperCase();
    const dopUsdRate = Number(process.env.PAYPAL_DOP_USD_RATE);
    const configured = Boolean(
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET &&
      process.env.APP_PUBLIC_URL &&
      process.env.API_PUBLIC_URL,
    );
    const sandboxOnly = process.env.PAYPAL_ENV !== 'live';
    const conversionConfigured =
      checkoutCurrency === 'USD' &&
      Number.isFinite(dopUsdRate) &&
      dopUsdRate > 0;
    const currencyReady =
      SUPPORTED_PAYPAL_CURRENCIES.includes(
        checkoutCurrency as (typeof SUPPORTED_PAYPAL_CURRENCIES)[number],
      ) && conversionConfigured;
    const onlinePaymentsEnabled = configured && sandboxOnly && currencyReady;
    return {
      provider: 'PAYPAL',
      environment: 'sandbox' as const,
      configured: configured && sandboxOnly,
      onlinePaymentsEnabled,
      webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      appPublicUrlConfigured: Boolean(process.env.APP_PUBLIC_URL),
      apiPublicUrlConfigured: Boolean(process.env.API_PUBLIC_URL),
      checkoutCurrency,
      currencySupported: currencyReady,
      conversionConfigured,
      sandboxOnly,
      message: !sandboxOnly
        ? 'PayPal Live no esta habilitado en esta fase. Configure PAYPAL_ENV=sandbox.'
        : !configured
          ? 'Pago online no configurado. Contacta a facturacion o usa transferencia manual.'
          : !currencyReady
            ? 'La moneda actual no esta disponible para PayPal. Contacta facturacion.'
            : 'Pago online disponible con PayPal.',
    };
  }

  async testConnection() {
    const configuration = this.configuration();
    const testedAt = new Date();
    if (!configuration.configured) {
      return {
        configured: false,
        reachable: false,
        environment: configuration.environment,
        testedAt,
        error: configuration.message,
      };
    }
    try {
      await this.accessToken();
      return {
        configured: true,
        reachable: true,
        environment: configuration.environment,
        testedAt,
        error: null,
      };
    } catch {
      return {
        configured: true,
        reachable: false,
        environment: configuration.environment,
        testedAt,
        error:
          'No se pudo autenticar con PayPal Sandbox. Verifique credenciales y conectividad.',
      };
    }
  }

  async createForInvoice(
    companyId: string,
    invoiceId: string,
    planChangeRequestId?: string,
  ) {
    const configuration = this.configuration();
    if (!configuration.configured)
      throw this.gatewayError(
        'PAYMENT_PROVIDER_NOT_CONFIGURED',
        configuration.message,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    if (!configuration.currencySupported)
      throw this.gatewayError(
        'PAYMENT_CURRENCY_NOT_SUPPORTED',
        configuration.message,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        status: {
          in: [
            SubscriptionInvoiceStatus.PENDING,
            SubscriptionInvoiceStatus.PARTIALLY_PAID,
            SubscriptionInvoiceStatus.OVERDUE,
          ],
        },
      },
    });
    if (!invoice)
      throw new NotFoundException('Factura pendiente no encontrada.');
    if (planChangeRequestId) {
      const request = await this.prisma.planChangeRequest.findFirst({
        where: {
          id: planChangeRequestId,
          companyId,
          invoiceId,
          status: { in: ['APPROVED_PENDING_PAYMENT', 'PAYMENT_FAILED'] },
        },
      });
      if (!request)
        throw new ConflictException('La solicitud no admite checkout.');
    }
    const reusable = await this.prisma.paymentCheckoutSession.findFirst({
      where: {
        invoiceId,
        companyId,
        status: {
          in: [PaymentCheckoutStatus.PENDING, PaymentCheckoutStatus.APPROVED],
        },
        expiresAt: { gt: new Date() },
      },
    });
    if (reusable?.checkoutUrl) return reusable;
    const exchangeRate = new Prisma.Decimal(
      process.env.PAYPAL_DOP_USD_RATE ?? '0',
    );
    const providerAmount = invoice.balance.div(exchangeRate).toDecimalPlaces(2);
    const exchangeRateCapturedAt = new Date();
    const session = await this.prisma.paymentCheckoutSession.create({
      data: {
        companyId,
        invoiceId,
        planChangeRequestId,
        provider: PaymentProvider.PAYPAL_CHECKOUT,
        amount: invoice.balance,
        currency: invoice.currency,
        invoiceAmount: invoice.balance,
        invoiceCurrency: invoice.currency,
        providerAmount,
        providerCurrency: configuration.checkoutCurrency,
        exchangeRate,
        exchangeRateSource: 'MANUAL_ENV',
        exchangeRateCapturedAt,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const returnUrl = `${process.env.APP_PUBLIC_URL}/settings/billing?paypal=return&checkoutSessionId=${encodeURIComponent(session.id)}`;
    const cancelUrl = `${process.env.APP_PUBLIC_URL}/settings/billing?paypal=cancel&checkoutSessionId=${encodeURIComponent(session.id)}`;
    const accessToken = await this.accessToken();
    const response = await fetch(`${this.baseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: this.headers(accessToken),
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: invoice.id,
            custom_id: `${companyId}:${invoice.id}`,
            amount: {
              currency_code: configuration.checkoutCurrency,
              value: providerAmount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });
    const order = (await response.json()) as PayPalOrder;
    if (!response.ok || !order.id) {
      const raw = JSON.stringify(order);
      const currencyRejected =
        /currency|CURRENCY_NOT_SUPPORTED|UNSUPPORTED_PAYEE_CURRENCY/i.test(raw);
      throw this.gatewayError(
        currencyRejected
          ? 'PAYMENT_CURRENCY_NOT_SUPPORTED'
          : 'PAYMENT_CHECKOUT_FAILED',
        currencyRejected
          ? 'La moneda actual no esta disponible para PayPal. Contacta facturacion.'
          : 'No se pudo iniciar el checkout. Intenta nuevamente o contacta soporte.',
        currencyRejected
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.BAD_GATEWAY,
      );
    }
    const checkoutUrl = order.links?.find(
      (link) => link.rel === 'approve',
    )?.href;
    if (!checkoutUrl)
      throw this.gatewayError(
        'PAYMENT_CHECKOUT_URL_MISSING',
        'No se pudo iniciar el checkout. Intenta nuevamente o contacta soporte.',
        HttpStatus.BAD_GATEWAY,
      );
    const readySession = await this.prisma.paymentCheckoutSession.update({
      where: { id: session.id },
      data: {
        providerOrderId: order.id,
        providerSessionId: order.id,
        checkoutUrl,
      },
    });
    if (planChangeRequestId)
      await this.prisma.planChangeRequest.update({
        where: { id: planChangeRequestId },
        data: { checkoutSessionId: readySession.id },
      });
    return readySession;
  }

  async createForPlanChange(companyId: string, id: string) {
    const request = await this.prisma.planChangeRequest.findFirst({
      where: { id, companyId },
    });
    if (!request?.invoiceId)
      throw new NotFoundException('La solicitud no tiene factura.');
    return this.createForInvoice(companyId, request.invoiceId, id);
  }

  getSession(companyId: string, id: string) {
    return this.prisma.paymentCheckoutSession.findFirstOrThrow({
      where: { id, companyId },
    });
  }

  async captureCheckout(user: AuthUser, id: string) {
    const session = await this.prisma.paymentCheckoutSession.findFirst({
      where: { id, companyId: user.companyId },
      include: { invoice: true, planChangeRequest: true },
    });
    if (!session) throw new NotFoundException('Checkout PayPal no encontrado.');
    if (session.provider !== PaymentProvider.PAYPAL_CHECKOUT)
      throw new ConflictException('El checkout no pertenece a PayPal.');
    if (session.status === PaymentCheckoutStatus.PAID)
      return {
        success: true,
        idempotent: true,
        message: 'Pago confirmado. Tu plan fue aplicado.',
      };
    if (
      session.status !== PaymentCheckoutStatus.PENDING &&
      session.status !== PaymentCheckoutStatus.APPROVED
    )
      throw new ConflictException('El checkout no admite captura.');
    if (!session.providerOrderId)
      throw new ConflictException('El checkout no tiene una orden PayPal.');

    const order = await this.captureOrReconcileOrder(session.providerOrderId);
    const capture = order.purchase_units
      ?.flatMap((unit) => unit.payments?.captures ?? [])
      .find((item) => item.status === 'COMPLETED');
    if (order.status !== 'COMPLETED' || !capture?.id)
      throw new BadGatewayException(
        'PayPal todavia no confirma la captura. No se aplico ningun cambio.',
      );
    await this.applyCompletedCapture(
      null,
      session,
      { resource: { id: capture.id, amount: capture.amount } },
      session.providerOrderId,
      user.userId,
    );
    return {
      success: true,
      idempotent: false,
      message: 'Pago confirmado. Tu plan fue aplicado.',
    };
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: PayPalEvent,
  ) {
    if (!payload.id || !payload.event_type)
      throw new UnauthorizedException('Webhook PayPal invalido.');
    const valid = await this.verifyWebhook(headers, payload);
    if (!valid) throw new UnauthorizedException('Firma PayPal invalida.');
    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: PaymentProvider.PAYPAL_CHECKOUT,
          eventId: payload.id,
        },
      },
    });
    if (existing) return { received: true, duplicate: true };
    const event = await this.prisma.paymentWebhookEvent.create({
      data: {
        provider: PaymentProvider.PAYPAL_CHECKOUT,
        eventId: payload.id,
        eventType: payload.event_type,
        payload,
      },
    });
    if (!PAYPAL_EVENTS.includes(payload.event_type as never)) {
      await this.markWebhookProcessed(event.id);
      return { received: true };
    }
    const orderId = await this.orderIdForCapture(payload.resource?.id);
    const session = await this.findSessionByOrderId(orderId);
    if (!session) throw new NotFoundException('Checkout PayPal no reconocido.');
    if (payload.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      await this.applyCompletedCapture(event.id, session, payload, orderId);
      return { received: true, applied: true };
    }
    await this.applyNonCompletedCapture(event.id, session, payload.event_type);
    return { received: true, applied: false };
  }

  async reconcileExpiredCheckouts() {
    const result = await this.prisma.paymentCheckoutSession.updateMany({
      where: {
        status: PaymentCheckoutStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: PaymentCheckoutStatus.EXPIRED },
    });
    return { expired: result.count };
  }

  private async applyCompletedCapture(
    eventId: string | null,
    session: CheckoutWithRelations,
    payload: PayPalEvent,
    orderId: string,
    userId?: string,
  ) {
    const captureId = payload.resource?.id;
    if (!captureId)
      throw new BadGatewayException('Captura PayPal sin identificador.');
    this.assertProviderAmountMatches(session, payload);
    await this.prisma.$transaction(async (tx) => {
      const lockedSession = await tx.paymentCheckoutSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { invoice: true, planChangeRequest: true },
      });
      if (lockedSession.status === PaymentCheckoutStatus.PAID) {
        if (eventId) await this.markWebhookProcessed(eventId, tx);
        return;
      }
      if (lockedSession.invoice.status === SubscriptionInvoiceStatus.PAID)
        throw new ConflictException('La factura ya fue pagada.');
      const existingPayment = await tx.subscriptionPayment.findUnique({
        where: { providerCaptureId: captureId },
      });
      if (existingPayment) {
        await tx.paymentCheckoutSession.update({
          where: { id: lockedSession.id },
          data: {
            status: PaymentCheckoutStatus.PAID,
            paidAt: existingPayment.paidAt,
          },
        });
        if (eventId) await this.markWebhookProcessed(eventId, tx);
        return;
      }
      const subscription = await tx.companySubscription.findUniqueOrThrow({
        where: { companyId: lockedSession.companyId },
      });
      await tx.subscriptionPayment.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId: lockedSession.companyId,
          subscriptionInvoiceId: lockedSession.invoiceId,
          amount: lockedSession.invoiceAmount,
          currency: lockedSession.invoiceCurrency,
          method: SubscriptionPaymentMethod.PAYPAL,
          reference: orderId,
          providerCaptureId: captureId,
          paidAt: new Date(),
        },
      });
      await tx.subscriptionInvoice.update({
        where: { id: lockedSession.invoiceId },
        data: {
          status: SubscriptionInvoiceStatus.PAID,
          amountPaid: lockedSession.invoice.total,
          balance: 0,
          paidAt: new Date(),
        },
      });
      await tx.paymentCheckoutSession.update({
        where: { id: lockedSession.id },
        data: { status: PaymentCheckoutStatus.PAID, paidAt: new Date() },
      });
      if (lockedSession.planChangeRequest) {
        if (
          lockedSession.planChangeRequest.status !== 'APPROVED_PENDING_PAYMENT'
        )
          throw new ConflictException('La solicitud no admite aplicacion.');
        await tx.companySubscription.update({
          where: { id: subscription.id },
          data: {
            planId: lockedSession.planChangeRequest.requestedPlanId,
            status: CompanySubscriptionStatus.ACTIVE,
            lastPaymentAt: new Date(),
          },
        });
        await tx.planChangeRequest.update({
          where: { id: lockedSession.planChangeRequest.id },
          data: { status: 'APPROVED_APPLIED' },
        });
        await tx.subscriptionEvent.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId: lockedSession.companyId,
            type: SubscriptionEventType.PLAN_ASSIGNED,
            message: 'Plan aplicado despues de pago PayPal confirmado.',
            metadata: {
              planChangeRequestId: lockedSession.planChangeRequest.id,
              checkoutSessionId: lockedSession.id,
              providerCaptureId: captureId,
            },
          },
        });
      }
      await tx.company.update({
        where: { id: lockedSession.companyId },
        data: { status: CompanyStatus.ACTIVE },
      });
      await tx.auditLog.create({
        data: {
          companyId: lockedSession.companyId,
          userId,
          action: 'PAYPAL_CAPTURE_APPLIED',
          module: 'company-billing',
          entityType: 'PaymentCheckoutSession',
          entityId: lockedSession.id,
          description:
            'Pago PayPal confirmado y aplicado de forma idempotente.',
          metadataJson: {
            orderId,
            captureId,
            source: eventId ? 'WEBHOOK' : 'RETURN',
          },
        },
      });
      if (eventId) await this.markWebhookProcessed(eventId, tx);
    });
  }

  private async captureOrReconcileOrder(orderId: string) {
    const token = await this.accessToken();
    const captureResponse = await fetch(
      `${this.baseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      { method: 'POST', headers: this.headers(token), body: '{}' },
    );
    const captured = (await captureResponse.json()) as PayPalOrder;
    if (captureResponse.ok) return captured;
    const lookupResponse = await fetch(
      `${this.baseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      { headers: this.headers(token) },
    );
    const reconciled = (await lookupResponse.json()) as PayPalOrder;
    if (lookupResponse.ok && reconciled.status === 'COMPLETED')
      return reconciled;
    throw new BadGatewayException(
      'PayPal no pudo completar la captura. No se aplico ningun cambio.',
    );
  }

  private async applyNonCompletedCapture(
    eventId: string,
    session: CheckoutWithRelations,
    eventType: string,
  ) {
    const failed = [
      'PAYMENT.CAPTURE.DENIED',
      'PAYMENT.CAPTURE.REFUNDED',
      'PAYMENT.CAPTURE.REVERSED',
      'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
    ].includes(eventType);
    await this.prisma.$transaction(async (tx) => {
      if (failed)
        await tx.paymentCheckoutSession.update({
          where: { id: session.id },
          data: { status: PaymentCheckoutStatus.FAILED },
        });
      if (session.planChangeRequest && failed)
        await tx.planChangeRequest.update({
          where: { id: session.planChangeRequest.id },
          data: { status: 'PAYMENT_FAILED' },
        });
      const subscription = await tx.companySubscription.findUnique({
        where: { companyId: session.companyId },
      });
      if (subscription)
        await tx.subscriptionEvent.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId: session.companyId,
            type: SubscriptionEventType.SUBSCRIPTION_UPDATED,
            message:
              eventType === 'PAYMENT.CAPTURE.REFUNDED' ||
              eventType === 'PAYMENT.CAPTURE.REVERSED'
                ? 'Alerta administrativa: PayPal informo refund/reversal. Revisar suscripcion manualmente.'
                : 'PayPal informo una captura no completada. Revisar checkout.',
            metadata: {
              eventType,
              checkoutSessionId: session.id,
              planChangeRequestId: session.planChangeRequest?.id,
            },
          },
        });
      await this.markWebhookProcessed(eventId, tx);
    });
  }

  private baseUrl() {
    return 'https://api-m.sandbox.paypal.com';
  }

  private gatewayError(code: string, message: string, status: HttpStatus) {
    return new HttpException({ statusCode: status, code, message }, status);
  }

  private headers(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': randomUUID(),
    };
  }

  private async accessToken() {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
    ).toString('base64');
    const response = await fetch(`${this.baseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const body = (await response.json()) as { access_token?: string };
    if (!response.ok || !body.access_token)
      throw new BadGatewayException('No se pudo autenticar con PayPal.');
    return body.access_token;
  }

  private async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: PayPalEvent,
  ) {
    if (!process.env.PAYPAL_WEBHOOK_ID) return false;
    const token = await this.accessToken();
    const response = await fetch(
      `${this.baseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: process.env.PAYPAL_WEBHOOK_ID,
          webhook_event: payload,
        }),
      },
    );
    const body = (await response.json()) as { verification_status?: string };
    return response.ok && body.verification_status === 'SUCCESS';
  }

  private async orderIdForCapture(captureId?: string) {
    if (!captureId) return '';
    const token = await this.accessToken();
    const response = await fetch(
      `${this.baseUrl()}/v2/payments/captures/${captureId}`,
      { headers: this.headers(token) },
    );
    const body = (await response.json()) as {
      supplementary_data?: { related_ids?: { order_id?: string } };
    };
    return body.supplementary_data?.related_ids?.order_id ?? '';
  }

  private findSessionByOrderId(orderId: string) {
    return this.prisma.paymentCheckoutSession.findFirst({
      where: { providerOrderId: orderId },
      include: { invoice: true, planChangeRequest: true },
    });
  }

  private assertProviderAmountMatches(
    session: CheckoutWithRelations,
    payload: PayPalEvent,
  ) {
    const amount = payload.resource?.amount;
    if (!amount) return;
    if (
      !session.providerAmount ||
      !session.providerCurrency ||
      !amount.value ||
      amount.currency_code !== session.providerCurrency
    )
      throw this.gatewayError(
        'PAYMENT_PROVIDER_AMOUNT_MISMATCH',
        'PayPal notifico una moneda distinta a la sesion.',
        HttpStatus.CONFLICT,
      );
    if (!new Prisma.Decimal(amount.value).equals(session.providerAmount))
      throw this.gatewayError(
        'PAYMENT_PROVIDER_AMOUNT_MISMATCH',
        'PayPal notifico un monto distinto a la sesion.',
        HttpStatus.CONFLICT,
      );
  }

  private markWebhookProcessed(
    eventId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return tx.paymentWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: PaymentWebhookStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
  }
}
