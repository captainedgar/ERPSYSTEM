import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyStatus } from '@prisma/client';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../interfaces/auth-user.interface';

const ALLOWED_SUSPENDED_PATHS = new Set([
  '/auth/me',
  '/auth/logout',
  '/auth/refresh',
]);

@Injectable()
export class CompanySuspensionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!request.user) return true;
    if (request.user.companyStatus !== CompanyStatus.SUSPENDED) return true;

    const path = request.path ?? request.url.split('?')[0];
    if (ALLOWED_SUSPENDED_PATHS.has(path)) return true;

    throw new ForbiddenException(
      'Tu empresa esta suspendida por falta de pago.',
    );
  }
}
