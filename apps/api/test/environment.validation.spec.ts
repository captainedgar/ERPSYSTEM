import { ConfigService } from '@nestjs/config';

import { getCorsOrigins } from '../src/config/cors.config';
import { validateEnvironment } from '../src/config/environment.validation';

const validStaging = {
  NODE_ENV: 'staging',
  DATABASE_URL: 'postgresql://user:password@db.example.com:5432/comercia',
  JWT_SECRET: 'access-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
  APP_PUBLIC_URL: 'https://staging.example.com',
  API_PUBLIC_URL: 'https://api-staging.example.com',
  CORS_ORIGIN: 'https://staging.example.com',
  PAYPAL_ENV: 'sandbox',
  PAYPAL_CLIENT_ID: 'public-client-id',
  PAYPAL_CLIENT_SECRET: 'private-client-secret',
  PAYPAL_CHECKOUT_CURRENCY: 'USD',
  PAYPAL_WEBHOOK_ID: 'sandbox-webhook-id',
};

describe('environment validation', () => {
  it('does not require deployment variables in test', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toEqual({
      NODE_ENV: 'test',
    });
  });

  it('accepts a complete staging configuration', () => {
    expect(validateEnvironment({ ...validStaging })).toEqual(validStaging);
  });

  it('fails staging without the PayPal webhook id', () => {
    const config: Record<string, unknown> = { ...validStaging };
    delete config.PAYPAL_WEBHOOK_ID;
    expect(() => validateEnvironment(config)).toThrow('PAYPAL_WEBHOOK_ID');
  });

  it('rejects wildcard CORS and PayPal Live in staging', () => {
    expect(() =>
      validateEnvironment({ ...validStaging, CORS_ORIGIN: '*' }),
    ).toThrow('CORS_ORIGIN');
    expect(() =>
      validateEnvironment({ ...validStaging, PAYPAL_ENV: 'live' }),
    ).toThrow('sandbox');
  });
});

describe('CORS configuration', () => {
  it('uses only the configured origin in staging', () => {
    const config = new ConfigService(validStaging);
    expect(getCorsOrigins(config)).toBe(validStaging.CORS_ORIGIN);
  });

  it('keeps localhost available in development', () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
      WEB_PORT: 3000,
    });
    expect(getCorsOrigins(config)).toContain('http://localhost:3000');
  });
});
