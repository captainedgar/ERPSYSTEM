import type { ConfigService } from '@nestjs/config';

export function getCorsOrigins(config: ConfigService) {
  const environment = config.get<string>('NODE_ENV', 'development');
  const configuredOrigin = config.get<string>('CORS_ORIGIN')?.trim();

  if (environment === 'staging' || environment === 'production') {
    return configuredOrigin as string;
  }

  const webPort = config.get<number>('WEB_PORT', 3000);
  return Array.from(
    new Set(
      [configuredOrigin, `http://localhost:${webPort}`].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  );
}
