import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { PlatformAuthUser } from './platform.types';

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { platformUser: PlatformAuthUser }>();
    return request.platformUser;
  },
);
