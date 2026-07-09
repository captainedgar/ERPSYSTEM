import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyStatus,
  CompanySubscriptionStatus,
  PlatformRole,
  Prisma,
  SaasBillingInterval,
  SubscriptionEventType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import {
  CreateSaasPlanDto,
  RegisterSubscriptionPaymentDto,
  UpdateSaasPlanDto,
  UpdateSaasPlanStatusDto,
  UpsertCompanySubscriptionDto,
} from './platform-billing.dto';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';

const planInclude = {
  _count: { select: { subscriptions: true } },
} satisfies Prisma.SaasPlanInclude;

const subscriptionInclude = {
  plan: true,
  company: { select: { id: true, name: true, status: true } },
} satisfies Prisma.CompanySubscriptionInclude;

export interface BillingOverdueProcessResult {
  movedToGracePeriod: number;
  companiesSuspended: number;
  noActionRequired: number;
}

@Injectable()
export class PlatformBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  listPlans() {
    return this.prisma.saasPlan.findMany({
      include: planInclude,
      orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { name: 'asc' }],
    });
  }

  async createPlan(
    user: PlatformAuthUser,
    dto: CreateSaasPlanDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const plan = await this.prisma.saasPlan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        price: dto.price,
        currency: dto.currency,
        billingInterval: dto.billingInterval,
        graceDays: dto.graceDays,
        maxUsers: dto.maxUsers,
        maxBranches: dto.maxBranches,
        modules: dto.modules,
      },
      include: planInclude,
    });
    await this.audit.create({
      user,
      action: 'SAAS_PLAN_CREATED',
      module: 'platform_billing',
      entityType: 'SaasPlan',
      entityId: plan.id,
      description: `Plan SaaS ${plan.name} creado`,
      metadata: { price: plan.price.toString(), currency: plan.currency },
      ...context,
    });
    return plan;
  }

  async getPlan(id: string) {
    const plan = await this.prisma.saasPlan.findUnique({
      where: { id },
      include: planInclude,
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  async updatePlan(
    user: PlatformAuthUser,
    id: string,
    dto: UpdateSaasPlanDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    await this.getPlan(id);
    const plan = await this.prisma.saasPlan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        price: dto.price,
        currency: dto.currency,
        billingInterval: dto.billingInterval,
        graceDays: dto.graceDays,
        maxUsers: dto.maxUsers,
        maxBranches: dto.maxBranches,
        modules: dto.modules,
      },
      include: planInclude,
    });
    await this.audit.create({
      user,
      action: 'SAAS_PLAN_UPDATED',
      module: 'platform_billing',
      entityType: 'SaasPlan',
      entityId: plan.id,
      description: `Plan SaaS ${plan.name} actualizado`,
      metadata: { fields: Object.keys(dto) },
      ...context,
    });
    return plan;
  }

  async updatePlanStatus(
    user: PlatformAuthUser,
    id: string,
    dto: UpdateSaasPlanStatusDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    await this.getPlan(id);
    const plan = await this.prisma.saasPlan.update({
      where: { id },
      data: { isActive: dto.isActive },
      include: planInclude,
    });
    await this.audit.create({
      user,
      action: dto.isActive ? 'SAAS_PLAN_ENABLED' : 'SAAS_PLAN_DISABLED',
      module: 'platform_billing',
      entityType: 'SaasPlan',
      entityId: plan.id,
      description: `Plan SaaS ${dto.isActive ? 'activado' : 'desactivado'}`,
      ...context,
    });
    return plan;
  }

  async getCompanySubscription(companyId: string) {
    await this.ensureCompany(companyId);
    return this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: subscriptionInclude,
    });
  }

  async upsertCompanySubscription(
    user: PlatformAuthUser,
    companyId: string,
    dto: UpsertCompanySubscriptionDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    await this.ensureCompany(companyId);
    const plan = await this.prisma.saasPlan.findFirst({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) throw new BadRequestException('Plan activo no encontrado');

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const currentPeriodStart = dto.currentPeriodStart
      ? new Date(dto.currentPeriodStart)
      : startsAt;
    const currentPeriodEnd = dto.currentPeriodEnd
      ? new Date(dto.currentPeriodEnd)
      : this.addBillingInterval(currentPeriodStart, plan.billingInterval);
    const nextPaymentDueAt = dto.nextPaymentDueAt
      ? new Date(dto.nextPaymentDueAt)
      : currentPeriodEnd;
    const graceDays = dto.graceDays ?? plan.graceDays;

    const existing = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      select: { id: true },
    });
    const subscription = await this.prisma.companySubscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId: plan.id,
        status: dto.status ?? CompanySubscriptionStatus.ACTIVE,
        startsAt,
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDueAt,
        graceDays,
      },
      update: {
        planId: plan.id,
        status: dto.status ?? CompanySubscriptionStatus.ACTIVE,
        startsAt,
        currentPeriodStart,
        currentPeriodEnd,
        nextPaymentDueAt,
        graceDays,
        graceEndsAt: null,
        scheduledSuspensionAt: null,
      },
      include: subscriptionInclude,
    });
    await this.createEvent(
      subscription.id,
      companyId,
      existing
        ? SubscriptionEventType.PLAN_ASSIGNED
        : SubscriptionEventType.SUBSCRIPTION_CREATED,
      existing
        ? `Plan ${plan.name} asignado a empresa`
        : `Suscripcion creada con plan ${plan.name}`,
      user,
      { planId: plan.id, nextPaymentDueAt: nextPaymentDueAt.toISOString() },
    );
    await this.audit.create({
      user,
      action: existing
        ? 'COMPANY_SUBSCRIPTION_UPDATED'
        : 'COMPANY_SUBSCRIPTION_ASSIGNED',
      module: 'platform_billing',
      entityType: 'CompanySubscription',
      entityId: subscription.id,
      description: existing
        ? 'Suscripcion de empresa actualizada'
        : 'Suscripcion de empresa asignada',
      metadata: { companyId, planId: plan.id },
      ...context,
    });
    return subscription;
  }

  async registerPayment(
    user: PlatformAuthUser,
    companyId: string,
    dto: RegisterSubscriptionPaymentDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { company: true, plan: true },
    });
    if (!subscription) {
      throw new BadRequestException('La empresa no tiene suscripcion');
    }
    const paidAt = new Date(dto.paidAt);
    const currentPeriodStart = paidAt;
    const currentPeriodEnd = dto.nextPaymentDueAt
      ? new Date(dto.nextPaymentDueAt)
      : this.addBillingInterval(paidAt, subscription.plan.billingInterval);
    const nextPaymentDueAt = currentPeriodEnd;

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId,
          amount: dto.amount,
          currency: dto.currency,
          method: dto.method,
          reference: dto.reference?.trim(),
          notes: dto.notes?.trim(),
          paidAt,
          createdByPlatformUserId: user.platformUserId,
        },
      });
      const updated = await tx.companySubscription.update({
        where: { id: subscription.id },
        data: {
          lastPaymentAt: paidAt,
          currentPeriodStart,
          currentPeriodEnd,
          nextPaymentDueAt,
          status: CompanySubscriptionStatus.ACTIVE,
          graceEndsAt: null,
          scheduledSuspensionAt: null,
          suspendedAt: null,
        },
        include: subscriptionInclude,
      });
      if (subscription.status === CompanySubscriptionStatus.SUSPENDED) {
        await tx.company.update({
          where: { id: companyId },
          data: { status: CompanyStatus.ACTIVE },
        });
      }
      await tx.subscriptionEvent.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId,
          type: SubscriptionEventType.PAYMENT_REGISTERED,
          message: 'Pago manual registrado',
          metadata: {
            paymentId: payment.id,
            amount: dto.amount,
            nextPaymentDueAt: nextPaymentDueAt.toISOString(),
          },
          createdByPlatformUserId: user.platformUserId,
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId,
          type: SubscriptionEventType.NEXT_PAYMENT_DATE_UPDATED,
          message: 'Proxima fecha de pago actualizada',
          metadata: { nextPaymentDueAt: nextPaymentDueAt.toISOString() },
          createdByPlatformUserId: user.platformUserId,
        },
      });
      if (
        subscription.status === CompanySubscriptionStatus.SUSPENDED ||
        subscription.company.status === CompanyStatus.SUSPENDED
      ) {
        await tx.subscriptionEvent.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId,
            type: SubscriptionEventType.COMPANY_REACTIVATED_AFTER_PAYMENT,
            message: 'Empresa reactivada automaticamente tras registrar pago',
            metadata: {
              paymentId: payment.id,
              nextPaymentDueAt: nextPaymentDueAt.toISOString(),
            },
            createdByPlatformUserId: user.platformUserId,
          },
        });
      }
      return { payment, subscription: updated };
    });
    await this.audit.create({
      user,
      action: 'SUBSCRIPTION_PAYMENT_REGISTERED',
      module: 'platform_billing',
      entityType: 'SubscriptionPayment',
      entityId: result.payment.id,
      description: 'Pago manual de suscripcion registrado',
      metadata: {
        companyId,
        amount: dto.amount,
        nextPaymentDueAt: nextPaymentDueAt.toISOString(),
      },
      ...context,
    });
    if (
      subscription.status === CompanySubscriptionStatus.SUSPENDED ||
      subscription.company.status === CompanyStatus.SUSPENDED
    ) {
      await this.audit.create({
        user,
        action: 'COMPANY_REACTIVATED_AFTER_PAYMENT',
        module: 'platform_billing',
        entityType: 'Company',
        entityId: companyId,
        description: 'Empresa reactivada automaticamente tras registrar pago',
        metadata: {
          subscriptionId: subscription.id,
          paymentId: result.payment.id,
        },
        ...context,
      });
    }
    return result;
  }

  async processOverdueSubscriptions(
    user: PlatformAuthUser | null,
    context: PlatformRequestContext = {},
    now = new Date(),
  ): Promise<BillingOverdueProcessResult> {
    if (user) this.requireBillingAdmin(user);

    const result = await this.prisma.$transaction(async (tx) => {
      const total = await tx.companySubscription.count({
        where: {
          status: {
            in: [
              CompanySubscriptionStatus.ACTIVE,
              CompanySubscriptionStatus.GRACE_PERIOD,
            ],
          },
        },
      });
      const activeOverdue = await tx.companySubscription.findMany({
        where: {
          status: CompanySubscriptionStatus.ACTIVE,
          nextPaymentDueAt: { lte: now },
        },
        include: { company: true, plan: true },
        orderBy: { nextPaymentDueAt: 'asc' },
      });
      const graceExpired = await tx.companySubscription.findMany({
        where: {
          status: CompanySubscriptionStatus.GRACE_PERIOD,
          graceEndsAt: { lt: now },
        },
        include: { company: true, plan: true },
        orderBy: { graceEndsAt: 'asc' },
      });

      let movedToGracePeriod = 0;
      let companiesSuspended = 0;

      for (const subscription of activeOverdue) {
        await this.startGracePeriod(tx, subscription, user, now);
        movedToGracePeriod += 1;
      }

      for (const subscription of graceExpired) {
        await this.suspendForNonPayment(tx, subscription, user, now);
        companiesSuspended += 1;
      }

      await tx.platformAuditLog.create({
        data: {
          platformUserId: user?.platformUserId,
          action: 'BILLING_OVERDUE_PROCESS_RUN',
          module: 'platform_billing',
          description: 'Proceso de vencimientos de billing ejecutado',
          metadataJson: {
            movedToGracePeriod,
            companiesSuspended,
            noActionRequired: total - movedToGracePeriod - companiesSuspended,
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return {
        movedToGracePeriod,
        companiesSuspended,
        noActionRequired: total - movedToGracePeriod - companiesSuspended,
      };
    });

    return result;
  }

  async listCompanyPayments(companyId: string) {
    await this.ensureCompany(companyId);
    return this.prisma.subscriptionPayment.findMany({
      where: { companyId },
      include: {
        createdByPlatformUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async listCompanyEvents(companyId: string) {
    await this.ensureCompany(companyId);
    return this.prisma.subscriptionEvent.findMany({
      where: { companyId },
      include: {
        createdByPlatformUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPayments() {
    return this.prisma.subscriptionPayment.findMany({
      include: {
        company: { select: { id: true, name: true, status: true } },
        subscription: { include: { plan: true } },
        createdByPlatformUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: 100,
    });
  }

  listSubscriptions() {
    return this.prisma.companySubscription.findMany({
      include: subscriptionInclude,
      orderBy: { nextPaymentDueAt: 'asc' },
      take: 100,
    });
  }

  private async startGracePeriod(
    tx: Prisma.TransactionClient,
    subscription: Prisma.CompanySubscriptionGetPayload<{
      include: { company: true; plan: true };
    }>,
    user: PlatformAuthUser | null,
    now: Date,
  ) {
    const graceEndsAt = this.addDays(
      subscription.nextPaymentDueAt,
      subscription.graceDays,
    );
    await tx.companySubscription.update({
      where: { id: subscription.id },
      data: {
        status: CompanySubscriptionStatus.GRACE_PERIOD,
        graceEndsAt,
        scheduledSuspensionAt: graceEndsAt,
      },
    });
    await tx.subscriptionEvent.createMany({
      data: [
        {
          companySubscriptionId: subscription.id,
          companyId: subscription.companyId,
          type: SubscriptionEventType.SUBSCRIPTION_GRACE_STARTED,
          message: 'Suscripcion entro automaticamente en periodo de gracia',
          metadata: {
            nextPaymentDueAt: subscription.nextPaymentDueAt.toISOString(),
            graceEndsAt: graceEndsAt.toISOString(),
            processedAt: now.toISOString(),
          },
          createdByPlatformUserId: user?.platformUserId,
        },
        {
          companySubscriptionId: subscription.id,
          companyId: subscription.companyId,
          type: SubscriptionEventType.BILLING_OVERDUE_PROCESS_RUN,
          message: 'Proceso de vencimientos aplico periodo de gracia',
          metadata: { processedAt: now.toISOString() },
          createdByPlatformUserId: user?.platformUserId,
        },
      ],
    });
    await tx.platformAuditLog.create({
      data: {
        platformUserId: user?.platformUserId,
        action: 'SUBSCRIPTION_GRACE_STARTED',
        module: 'platform_billing',
        entityType: 'CompanySubscription',
        entityId: subscription.id,
        description: 'Suscripcion entro automaticamente en periodo de gracia',
        metadataJson: {
          companyId: subscription.companyId,
          nextPaymentDueAt: subscription.nextPaymentDueAt.toISOString(),
          graceEndsAt: graceEndsAt.toISOString(),
        },
      },
    });
  }

  private async suspendForNonPayment(
    tx: Prisma.TransactionClient,
    subscription: Prisma.CompanySubscriptionGetPayload<{
      include: { company: true; plan: true };
    }>,
    user: PlatformAuthUser | null,
    now: Date,
  ) {
    await tx.companySubscription.update({
      where: { id: subscription.id },
      data: {
        status: CompanySubscriptionStatus.SUSPENDED,
        suspendedAt: now,
      },
    });
    await tx.company.update({
      where: { id: subscription.companyId },
      data: { status: CompanyStatus.SUSPENDED },
    });
    await tx.subscriptionEvent.createMany({
      data: [
        {
          companySubscriptionId: subscription.id,
          companyId: subscription.companyId,
          type: SubscriptionEventType.COMPANY_AUTO_SUSPENDED_FOR_NON_PAYMENT,
          message: 'Empresa suspendida automaticamente por falta de pago',
          metadata: {
            graceEndsAt: subscription.graceEndsAt?.toISOString(),
            suspendedAt: now.toISOString(),
          },
          createdByPlatformUserId: user?.platformUserId,
        },
        {
          companySubscriptionId: subscription.id,
          companyId: subscription.companyId,
          type: SubscriptionEventType.BILLING_OVERDUE_PROCESS_RUN,
          message: 'Proceso de vencimientos aplico suspension automatica',
          metadata: { processedAt: now.toISOString() },
          createdByPlatformUserId: user?.platformUserId,
        },
      ],
    });
    await tx.platformAuditLog.create({
      data: {
        platformUserId: user?.platformUserId,
        action: 'COMPANY_AUTO_SUSPENDED_FOR_NON_PAYMENT',
        module: 'platform_billing',
        entityType: 'Company',
        entityId: subscription.companyId,
        description: 'Empresa suspendida automaticamente por falta de pago',
        metadataJson: {
          subscriptionId: subscription.id,
          graceEndsAt: subscription.graceEndsAt?.toISOString(),
          suspendedAt: now.toISOString(),
        },
      },
    });
  }

  private requireBillingAdmin(user: PlatformAuthUser) {
    if (
      user.role !== PlatformRole.SUPER_ADMIN &&
      user.role !== PlatformRole.BILLING_ADMIN
    ) {
      throw new ForbiddenException('No tienes permiso de billing');
    }
  }

  private async ensureCompany(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  private createEvent(
    subscriptionId: string,
    companyId: string,
    type: SubscriptionEventType,
    message: string,
    user: PlatformAuthUser,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.subscriptionEvent.create({
      data: {
        companySubscriptionId: subscriptionId,
        companyId,
        type,
        message,
        metadata,
        createdByPlatformUserId: user.platformUserId,
      },
    });
  }

  private addBillingInterval(date: Date, interval: SaasBillingInterval) {
    const next = new Date(date);
    if (interval === 'YEARLY') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
}
