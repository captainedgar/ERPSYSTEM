import { HttpException } from '@nestjs/common';
import { PaymentCheckoutStatus, Prisma } from '@prisma/client';
import { PaymentGatewayService } from '../src/company-billing/payment-gateway.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function response(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response;
}

function configureSandbox(rate = '58.50') {
  Object.assign(process.env, {
    PAYPAL_CLIENT_ID: 'sandbox-client',
    PAYPAL_CLIENT_SECRET: 'sandbox-secret',
    PAYPAL_ENV: 'sandbox',
    PAYPAL_WEBHOOK_ID: 'sandbox-webhook',
    APP_PUBLIC_URL: 'http://localhost:3000',
    API_PUBLIC_URL: 'http://localhost:3001',
    PAYPAL_CHECKOUT_CURRENCY: 'USD',
    PAYPAL_DOP_USD_RATE: rate,
  });
}

describe('PaymentGatewayService', () => {
  const original = { ...process.env };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    process.env = { ...original };
    fetchSpy.mockRestore();
  });

  it('reports PayPal as unavailable without credentials', () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    const service = new PaymentGatewayService({} as PrismaService);
    expect(service.configuration()).toMatchObject({
      provider: 'PAYPAL',
      configured: false,
      onlinePaymentsEnabled: false,
      environment: 'sandbox',
    });
  });

  it('does not enable PayPal Live in this phase', () => {
    configureSandbox();
    process.env.PAYPAL_ENV = 'live';
    const service = new PaymentGatewayService({} as PrismaService);
    expect(service.configuration()).toMatchObject({
      configured: false,
      onlinePaymentsEnabled: false,
      environment: 'live',
      sandboxOnly: false,
    });
  });

  it('requires an explicit positive DOP to USD conversion policy', () => {
    configureSandbox();
    const service = new PaymentGatewayService({} as PrismaService);
    expect(service.configuration()).toMatchObject({
      configured: true,
      currencySupported: true,
      checkoutCurrency: 'USD',
      onlinePaymentsEnabled: true,
      conversionConfigured: true,
      clientIdConfigured: true,
      clientSecretConfigured: true,
      dopUsdRate: 58.5,
    });
  });

  it('rejects plan-change checkout unless the request is approved pending payment', async () => {
    configureSandbox();
    const findPlanChange = jest.fn(() => Promise.resolve(null));
    const prisma = {
      subscriptionInvoice: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'invoice-1',
            companyId: 'company-1',
            balance: new Prisma.Decimal('1000'),
            currency: 'DOP',
          }),
        ),
      },
      planChangeRequest: { findFirst: findPlanChange },
    } as unknown as PrismaService;
    const service = new PaymentGatewayService(prisma);

    await expect(
      service.createForInvoice('company-1', 'invoice-1', 'request-failed'),
    ).rejects.toThrow('La solicitud no admite checkout.');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(findPlanChange).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'request-failed',
        status: 'APPROVED_PENDING_PAYMENT',
      }) as object,
    });
  });

  it('returns a sanitized connection test result', async () => {
    configureSandbox();
    fetchSpy.mockResolvedValueOnce(response({ access_token: 'token' }));
    const service = new PaymentGatewayService({} as PrismaService);
    await expect(service.testConnection()).resolves.toMatchObject({
      configured: true,
      reachable: true,
      environment: 'sandbox',
      error: null,
    });
  });

  it('returns PAYMENT_PROVIDER_NOT_CONFIGURED before reading an invoice', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    const service = new PaymentGatewayService({} as PrismaService);
    try {
      await service.createForInvoice('company', 'invoice');
      throw new Error('Expected createForInvoice to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      const payload = (error as HttpException).getResponse() as {
        code: string;
      };
      expect(payload.code).toBe('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }
  });

  it('freezes invoice amount, provider amount and exchange rate at checkout creation', async () => {
    configureSandbox('58.50');
    fetchSpy
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(
        response({
          id: 'ORDER-1',
          links: [{ rel: 'approve', href: 'https://paypal.test/approve' }],
        }),
      );
    const create = jest.fn(({ data }: { data: unknown }) =>
      Promise.resolve({
        id: 'checkout-1',
        ...(data as Record<string, unknown>),
      }),
    );
    const prisma = {
      subscriptionInvoice: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'invoice-1',
            companyId: 'company-1',
            balance: new Prisma.Decimal('117.00'),
            currency: 'DOP',
          }),
        ),
      },
      paymentCheckoutSession: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create,
        update: jest.fn(({ data }: { data: unknown }) =>
          Promise.resolve({ id: 'checkout-1', ...(data as object) }),
        ),
      },
    } as unknown as PrismaService;
    const service = new PaymentGatewayService(prisma);
    await service.createForInvoice('company-1', 'invoice-1');
    process.env.PAYPAL_DOP_USD_RATE = '60.00';
    const data = create.mock.calls[0]?.[0].data as {
      invoiceAmount: Prisma.Decimal;
      invoiceCurrency: string;
      providerAmount: Prisma.Decimal;
      providerCurrency: string;
      exchangeRate: Prisma.Decimal;
      exchangeRateSource: string;
      exchangeRateCapturedAt: Date;
    };
    expect(data.invoiceAmount.toFixed(2)).toBe('117.00');
    expect(data.invoiceCurrency).toBe('DOP');
    expect(data.providerAmount.toFixed(2)).toBe('2.00');
    expect(data.providerCurrency).toBe('USD');
    expect(data.exchangeRate.toFixed(6)).toBe('58.500000');
    expect(data.exchangeRateSource).toBe('MANUAL_ENV');
    expect(data.exchangeRateCapturedAt).toBeInstanceOf(Date);
  });

  it('rounds provider amount to two decimals', async () => {
    configureSandbox('58.50');
    fetchSpy
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(
        response({
          id: 'ORDER-2',
          links: [{ rel: 'approve', href: 'https://paypal.test/approve' }],
        }),
      );
    const prisma = {
      subscriptionInvoice: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'invoice-2',
            companyId: 'company-1',
            balance: new Prisma.Decimal('100.00'),
            currency: 'DOP',
          }),
        ),
      },
      paymentCheckoutSession: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(({ data }: { data: unknown }) =>
          Promise.resolve({ id: 'checkout-2', ...(data as object) }),
        ),
        update: jest.fn(({ data }: { data: unknown }) =>
          Promise.resolve({ id: 'checkout-2', ...(data as object) }),
        ),
      },
    } as unknown as PrismaService;
    const service = new PaymentGatewayService(prisma);
    await service.createForInvoice('company-1', 'invoice-2');
    const [, orderRequest] = fetchSpy.mock.calls;
    const rawOrderBody = orderRequest?.[1]?.body;
    if (typeof rawOrderBody !== 'string') {
      throw new Error('Expected order request body to be a string');
    }
    const orderBody = JSON.parse(rawOrderBody) as {
      purchase_units: Array<{ amount: { value: string } }>;
    };
    expect(orderBody.purchase_units[0]?.amount.value).toBe('1.71');
  });

  it('rejects webhook captures with inconsistent provider amount', async () => {
    configureSandbox();
    fetchSpy
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(response({ verification_status: 'SUCCESS' }))
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(
        response({
          supplementary_data: { related_ids: { order_id: 'ORDER-3' } },
        }),
      );
    const prisma = {
      paymentWebhookEvent: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(() => Promise.resolve({ id: 'event-1' })),
      },
      paymentCheckoutSession: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'checkout-3',
            companyId: 'company-1',
            providerOrderId: 'ORDER-3',
            providerAmount: new Prisma.Decimal('2.00'),
            providerCurrency: 'USD',
            invoice: { status: 'PENDING' },
            planChangeRequest: null,
          }),
        ),
      },
    } as unknown as PrismaService;
    const service = new PaymentGatewayService(prisma);
    await expect(
      service.handleWebhook(
        {
          'paypal-auth-algo': 'algo',
          'paypal-cert-url': 'cert',
          'paypal-transmission-id': 'transmission',
          'paypal-transmission-sig': 'sig',
          'paypal-transmission-time': 'time',
        },
        {
          id: 'WH-1',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'CAPTURE-1',
            amount: { currency_code: 'USD', value: '1.99' },
          },
        },
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('returns duplicate for already processed webhook event ids', async () => {
    configureSandbox();
    fetchSpy
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(response({ verification_status: 'SUCCESS' }));
    const prisma = {
      paymentWebhookEvent: {
        findUnique: jest.fn(() => Promise.resolve({ id: 'event-existing' })),
      },
    } as unknown as PrismaService;
    const service = new PaymentGatewayService(prisma);
    await expect(
      service.handleWebhook(
        {
          'paypal-auth-algo': 'algo',
          'paypal-cert-url': 'cert',
          'paypal-transmission-id': 'transmission',
          'paypal-transmission-sig': 'sig',
          'paypal-transmission-time': 'time',
        },
        {
          id: 'WH-DUP',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'CAPTURE-DUP' },
        },
      ),
    ).resolves.toEqual({ received: true, duplicate: true });
  });

  it('rejects capture sessions from another company without calling PayPal', async () => {
    configureSandbox();
    const service = new PaymentGatewayService({
      paymentCheckoutSession: {
        findFirst: jest.fn(() => Promise.resolve(null)),
      },
    } as unknown as PrismaService);

    await expect(
      service.captureCheckout(
        { companyId: 'company-2', userId: 'user-2' } as never,
        'checkout-1',
      ),
    ).rejects.toThrow('Checkout PayPal no encontrado.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects capture sessions without a PayPal order id', async () => {
    configureSandbox();
    const service = new PaymentGatewayService({
      paymentCheckoutSession: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'checkout-1',
            companyId: 'company-1',
            provider: 'PAYPAL_CHECKOUT',
            providerOrderId: null,
            status: 'PENDING',
            invoice: {},
            planChangeRequest: null,
          }),
        ),
      },
    } as unknown as PrismaService);

    await expect(
      service.captureCheckout(
        { companyId: 'company-1', userId: 'user-1' } as never,
        'checkout-1',
      ),
    ).rejects.toThrow('El checkout no tiene una orden PayPal.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('captures a completed order using only the frozen session amount', async () => {
    configureSandbox();
    fetchSpy
      .mockResolvedValueOnce(response({ access_token: 'token' }))
      .mockResolvedValueOnce(
        response({
          id: 'ORDER-1',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAPTURE-1',
                    status: 'COMPLETED',
                    amount: { currency_code: 'USD', value: '2.00' },
                  },
                ],
              },
            },
          ],
        }),
      );
    const session = {
      id: 'checkout-1',
      companyId: 'company-1',
      invoiceId: 'invoice-1',
      provider: 'PAYPAL_CHECKOUT',
      providerOrderId: 'ORDER-1',
      providerAmount: new Prisma.Decimal('2.00'),
      providerCurrency: 'USD',
      invoiceAmount: new Prisma.Decimal('117.00'),
      invoiceCurrency: 'DOP',
      status: 'PENDING',
      invoice: {
        id: 'invoice-1',
        status: 'PENDING',
        total: new Prisma.Decimal('117.00'),
      },
      planChangeRequest: {
        id: 'request-1',
        status: 'APPROVED_PENDING_PAYMENT',
        requestedPlanId: 'plan-pro',
      },
    };
    const tx = {
      paymentCheckoutSession: {
        findUniqueOrThrow: jest.fn(() => Promise.resolve(session)),
        update: jest.fn(() => Promise.resolve({})),
      },
      subscriptionPayment: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(() => Promise.resolve({})),
      },
      companySubscription: {
        findUniqueOrThrow: jest.fn(() =>
          Promise.resolve({ id: 'subscription-1' }),
        ),
        update: jest.fn(() => Promise.resolve({})),
      },
      subscriptionInvoice: { update: jest.fn(() => Promise.resolve({})) },
      planChangeRequest: { update: jest.fn(() => Promise.resolve({})) },
      subscriptionEvent: { create: jest.fn(() => Promise.resolve({})) },
      company: { update: jest.fn(() => Promise.resolve({})) },
      auditLog: { create: jest.fn(() => Promise.resolve({})) },
    };
    const prisma = {
      paymentCheckoutSession: {
        findFirst: jest.fn(() => Promise.resolve(session)),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new PaymentGatewayService(prisma);

    await expect(
      service.captureCheckout(
        { companyId: 'company-1', userId: 'user-1' } as never,
        'checkout-1',
      ),
    ).resolves.toMatchObject({ success: true, idempotent: false });
    expect(tx.subscriptionPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: session.invoiceAmount,
        providerCaptureId: 'CAPTURE-1',
      }) as object,
    });
    expect(tx.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }) as object,
      }) as object,
    );
    expect(tx.planChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'APPROVED_APPLIED' },
      }),
    );
    expect(tx.companySubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: 'plan-pro' }) as object,
      }) as object,
    );
  });

  it('returns idempotently for an already paid checkout without recapturing', async () => {
    const service = new PaymentGatewayService({
      paymentCheckoutSession: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 'checkout-paid',
            companyId: 'company-1',
            provider: 'PAYPAL_CHECKOUT',
            status: 'PAID',
            invoice: { status: 'PAID' },
            planChangeRequest: { status: 'APPROVED_APPLIED' },
          }),
        ),
      },
    } as unknown as PrismaService);

    await expect(
      service.captureCheckout(
        { companyId: 'company-1', userId: 'user-1' } as never,
        'checkout-paid',
      ),
    ).resolves.toMatchObject({ success: true, idempotent: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('expires pending checkout sessions through safe reconciliation', async () => {
    const updateMany = jest.fn(() => Promise.resolve({ count: 2 }));
    const service = new PaymentGatewayService({
      paymentCheckoutSession: { updateMany },
    } as unknown as PrismaService);
    await expect(service.reconcileExpiredCheckouts()).resolves.toEqual({
      expired: 2,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: PaymentCheckoutStatus.PENDING,
        expiresAt: { lte: expect.any(Date) as Date },
      },
      data: { status: PaymentCheckoutStatus.EXPIRED },
    });
  });
});
