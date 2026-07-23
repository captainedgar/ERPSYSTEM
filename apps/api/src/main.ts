import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { static as serveStatic } from 'express';

import { AppModule } from './app.module';
import {
  getCompanyLogoUploadRoot,
  getCompanyProductUploadRoot,
} from './common/upload-paths';
import { getCorsOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3001);
  const logoUploadsRoot = getCompanyLogoUploadRoot();

  app.use(
    '/uploads/company-logos',
    serveStatic(logoUploadsRoot, {
      fallthrough: false,
      immutable: true,
      maxAge: '7d',
    }),
  );
  app.use(
    '/uploads/companies',
    serveStatic(getCompanyProductUploadRoot(), {
      fallthrough: false,
      immutable: true,
      maxAge: '7d',
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    origin: getCorsOrigins(config),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  });
  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
