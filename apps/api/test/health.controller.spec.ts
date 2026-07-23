import { HealthController } from '../src/health.controller';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  it('reports a healthy API', () => {
    const result = new HealthController(
      new ConfigService({ NODE_ENV: 'test' }),
    ).getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('comercia-api');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(result.environment).toBe('test');
  });
});
