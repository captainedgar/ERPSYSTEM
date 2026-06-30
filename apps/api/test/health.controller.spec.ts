import { Test } from '@nestjs/testing';

import { HealthController } from '../src/health.controller';

describe('HealthController', () => {
  it('reports that the API is healthy', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    const controller = moduleRef.get(HealthController);

    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'comercia-api',
      timestamp: expect.any(String) as string,
    });
  });
});
