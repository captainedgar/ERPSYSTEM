const DEPLOYED_ENVIRONMENTS = new Set(['staging', 'production']);

const REQUIRED_DEPLOYED_VARIABLES = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'APP_PUBLIC_URL',
  'API_PUBLIC_URL',
  'CORS_ORIGIN',
  'PAYPAL_ENV',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_CHECKOUT_CURRENCY',
  'PAYPAL_WEBHOOK_ID',
] as const;

function valueOf(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

function requireHttpUrl(config: Record<string, unknown>, key: string) {
  const value = valueOf(config, key);
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${key} debe ser una URL HTTP(S) valida.`);
  }
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = valueOf(config, 'NODE_ENV') || 'development';
  if (!DEPLOYED_ENVIRONMENTS.has(environment)) return config;

  const missing = REQUIRED_DEPLOYED_VARIABLES.filter(
    (key) => !valueOf(config, key),
  );
  if (missing.length > 0) {
    throw new Error(
      `Configuracion incompleta para ${environment}. Variables requeridas: ${missing.join(', ')}.`,
    );
  }

  requireHttpUrl(config, 'APP_PUBLIC_URL');
  requireHttpUrl(config, 'API_PUBLIC_URL');
  requireHttpUrl(config, 'CORS_ORIGIN');

  if (valueOf(config, 'CORS_ORIGIN') === '*') {
    throw new Error('CORS_ORIGIN no puede ser wildcard en staging/production.');
  }
  if (valueOf(config, 'JWT_SECRET').length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }
  if (valueOf(config, 'JWT_REFRESH_SECRET').length < 32) {
    throw new Error('JWT_REFRESH_SECRET debe tener al menos 32 caracteres.');
  }
  if (!['sandbox', 'live'].includes(valueOf(config, 'PAYPAL_ENV'))) {
    throw new Error('PAYPAL_ENV debe ser sandbox o live.');
  }
  if (
    environment === 'staging' &&
    valueOf(config, 'PAYPAL_ENV') !== 'sandbox'
  ) {
    throw new Error('Staging solo admite PAYPAL_ENV=sandbox.');
  }

  return config;
}
