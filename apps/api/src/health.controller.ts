import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@comercia/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'comercia-api',
      timestamp: new Date().toISOString(),
    };
  }
}
