import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { CompanyEntitlementsService } from '../../company-entitlements/company-entitlements.service';
import { REQUIRED_PLAN_FEATURE_KEY } from '../decorators/require-plan-feature.decorator';
import type { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: CompanyEntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const feature = this.reflector.getAllAndOverride<string>(
      REQUIRED_PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!request.user) return true;
    await this.entitlements.assertFeature(request.user.companyId, feature);
    return true;
  }
}
