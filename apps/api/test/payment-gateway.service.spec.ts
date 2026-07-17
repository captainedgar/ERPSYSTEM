import { HttpException } from '@nestjs/common';
import { PaymentGatewayService } from '../src/company-billing/payment-gateway.service';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('PaymentGatewayService', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('reports PayPal as unavailable without credentials', () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    const service = new PaymentGatewayService({} as PrismaService);
    expect(service.configuration()).toMatchObject({
      provider: 'PAYPAL',
      configured: false,
      onlinePaymentsEnabled: false,
    });
  });

  it('requires an explicit DOP to USD conversion policy', () => {
    Object.assign(process.env, {
      PAYPAL_CLIENT_ID: 'test',
      PAYPAL_CLIENT_SECRET: 'test',
      APP_PUBLIC_URL: 'http://localhost:3000',
      API_PUBLIC_URL: 'http://localhost:3001',
      PAYPAL_CHECKOUT_CURRENCY: 'USD',
      PAYPAL_DOP_USD_RATE: '58.50',
    });
    const service = new PaymentGatewayService({} as PrismaService);
    expect(service.configuration()).toMatchObject({
      configured: true,
      currencySupported: true,
      checkoutCurrency: 'USD',
      onlinePaymentsEnabled: true,
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
      const response = (error as HttpException).getResponse() as {
        code: string;
      };
      expect(response.code).toBe('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }
  });
});
