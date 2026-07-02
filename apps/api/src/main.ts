import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3001);
  const webPort = config.get<number>('WEB_PORT', 3000);

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    origin: `http://localhost:${webPort}`,
    methods: ['GET', 'POST', 'PATCH', 'HEAD', 'OPTIONS'],
  });
  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
