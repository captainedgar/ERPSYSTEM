import {
  BadGatewayException,
  ConflictException,
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
  SubscriptionEventType,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: { id?: string };
};

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly prisma: PrismaService) {}

  configuration() {
    return {
      provider: 'PAYPAL_CHECKOUT',
      environment: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
      configured: Boolean(
        process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
      ),
      webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      status: 'NOT_TESTED',
    };
  }

  async createForInvoice(
    companyId: string,
    invoiceId: string,
    planChangeRequestId?: string,
  ) {
    if (!this.configuration().configured)
      throw new ConflictException('Pago online no configurado.');
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
              currency_code: invoice.currency,
              value: invoice.balance.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: `${process.env.APP_PUBLIC_URL}/settings/billing?paypal=return`,
          cancel_url: `${process.env.APP_PUBLIC_URL}/settings/billing?paypal=cancel`,
        },
      }),
    });
    const order = (await response.json()) as {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
    };
    if (!response.ok || !order.id)
      throw new BadGatewayException('PayPal no pudo crear el checkout.');
    const checkoutUrl = order.links?.find(
      (link) => link.rel === 'approve',
    )?.href;
    const session = await this.prisma.paymentCheckoutSession.create({
      data: {
        companyId,
        invoiceId,
        planChangeRequestId,
        provider: PaymentProvider.PAYPAL_CHECKOUT,
        providerOrderId: order.id,
        providerSessionId: order.id,
        amount: invoice.balance,
        currency: invoice.currency,
        checkoutUrl,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    if (planChangeRequestId)
      await this.prisma.planChangeRequest.update({
        where: { id: planChangeRequestId },
        data: { checkoutSessionId: session.id },
      });
    return session;
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

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: PayPalEvent,
  ) {
    if (!payload.id || !payload.event_type)
      throw new UnauthorizedException('Webhook PayPal inválido.');
    const valid = await this.verifyWebhook(headers, payload);
    if (!valid) throw new UnauthorizedException('Firma PayPal inválida.');
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
    if (payload.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: PaymentWebhookStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
      return { received: true };
    }
    const orderId = await this.orderIdForCapture(payload.resource?.id);
    const session = await this.prisma.paymentCheckoutSession.findFirst({
      where: { providerOrderId: orderId },
      include: { invoice: true, planChangeRequest: true },
    });
    if (!session) throw new NotFoundException('Checkout PayPal no reconocido.');
    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.companySubscription.findUniqueOrThrow({
        where: { companyId: session.companyId },
      });
      await tx.subscriptionPayment.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId: session.companyId,
          subscriptionInvoiceId: session.invoiceId,
          amount: session.amount,
          currency: session.currency,
          method: SubscriptionPaymentMethod.PAYPAL,
          reference: orderId,
          paidAt: new Date(),
        },
      });
      await tx.subscriptionInvoice.update({
        where: { id: session.invoiceId },
        data: {
          status: SubscriptionInvoiceStatus.PAID,
          amountPaid: session.invoice.total,
          balance: 0,
          paidAt: new Date(),
        },
      });
      await tx.paymentCheckoutSession.update({
        where: { id: session.id },
        data: { status: PaymentCheckoutStatus.PAID, paidAt: new Date() },
      });
      if (session.planChangeRequest) {
        await tx.companySubscription.update({
          where: { id: subscription.id },
          data: {
            planId: session.planChangeRequest.requestedPlanId,
            status: CompanySubscriptionStatus.ACTIVE,
            lastPaymentAt: new Date(),
          },
        });
        await tx.planChangeRequest.update({
          where: { id: session.planChangeRequest.id },
          data: { status: 'APPROVED_APPLIED' },
        });
        await tx.subscriptionEvent.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId: session.companyId,
            type: SubscriptionEventType.PLAN_ASSIGNED,
            message: 'Plan aplicado después de pago PayPal confirmado.',
            metadata: {
              planChangeRequestId: session.planChangeRequest.id,
              checkoutSessionId: session.id,
            },
          },
        });
      }
      await tx.company.update({
        where: { id: session.companyId },
        data: { status: CompanyStatus.ACTIVE },
      });
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: PaymentWebhookStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    });
    return { received: true, applied: true };
  }

  private baseUrl() {
    return process.env.PAYPAL_ENV === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
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
}
