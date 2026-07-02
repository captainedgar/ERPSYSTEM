import { HealthController } from '../src/health.controller';

describe('HealthController', () => {
  it('reports a healthy API', () => {
    const result = new HealthController().getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('comercia-api');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
