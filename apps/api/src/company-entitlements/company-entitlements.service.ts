import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  planCodeFromName,
  STANDARD_SAAS_PLANS,
  type SaasPlanCode,
} from './saas-plan-entitlements';

@Injectable()
export class CompanyEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(companyId: string) {
    const [subscription, branches, users, products] = await Promise.all([
      this.prisma.companySubscription.findUnique({
        where: { companyId },
        include: {
          plan: true,
          company: { select: { status: true } },
        },
      }),
      this.prisma.branch.count({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.user.count({
        where: { companyId, deletedAt: null, status: UserStatus.ACTIVE },
      }),
      this.prisma.product.count({
        where: { companyId, deletedAt: null },
      }),
    ]);
    if (!subscription) {
      throw new ForbiddenException(
        'La empresa no tiene un plan SaaS asignado.',
      );
    }
    const code = this.planCode(subscription.plan);
    const standard = STANDARD_SAAS_PLANS[code];
    const modules = this.modules(subscription.plan.modules);
    return {
      plan: {
        id: subscription.plan.id,
        code,
        name: subscription.plan.name,
        price: subscription.plan.price,
        billingInterval: subscription.plan.billingInterval,
      },
      subscriptionStatus: subscription.status,
      companyStatus: subscription.company.status,
      limits: {
        maxBranches: subscription.plan.maxBranches ?? standard.maxBranches,
        maxUsers: subscription.plan.maxUsers ?? standard.maxUsers,
        maxProducts: this.numberValue(
          modules.maxProducts,
          standard.maxProducts,
        ),
      },
      usage: { branches, users, products },
      features: standard.features.filter(
        (feature) => modules[feature] !== false,
      ),
    };
  }

  async assertLimit(
    companyId: string,
    resource: 'branches' | 'users' | 'products',
    increment = 1,
  ) {
    const snapshot = await this.snapshot(companyId);
    const limit = {
      branches: snapshot.limits.maxBranches,
      users: snapshot.limits.maxUsers,
      products: snapshot.limits.maxProducts,
    }[resource];
    if (limit === null || snapshot.usage[resource] + increment <= limit) return;
    const labels = {
      branches: 'sucursales',
      users: 'usuarios',
      products: 'productos',
    };
    throw new ConflictException(
      `Tu plan actual permite hasta ${limit} ${labels[resource]}. Mejora tu plan para agregar mas.`,
    );
  }

  async assertFeature(companyId: string, feature: string) {
    const snapshot = await this.snapshot(companyId);
    if (snapshot.features.includes(feature)) return;
    throw new ForbiddenException(
      `La funcion ${feature} no esta incluida en tu plan actual. Mejora tu plan para habilitarla.`,
    );
  }

  private planCode(plan: { name: string; modules: unknown }): SaasPlanCode {
    const modules = this.modules(plan.modules);
    const configured = modules.code;
    if (typeof configured === 'string' && configured in STANDARD_SAAS_PLANS) {
      return configured as SaasPlanCode;
    }
    return planCodeFromName(plan.name) ?? 'BASIC';
  }

  private modules(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private numberValue(value: unknown, fallback: number | null) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : fallback;
  }
}
