import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok' as const,
      service: 'comercia-api',
      timestamp: new Date().toISOString(),
      environment: this.config.get<string>('NODE_ENV', 'development'),
    };
  }
}
