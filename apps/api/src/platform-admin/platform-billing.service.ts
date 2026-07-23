import {
  BadRequestException,
  ConflictException,
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
  SubscriptionInvoiceStatus,
  SubscriptionPaymentLinkStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { MANUAL_PAYMENT_INSTRUCTIONS } from '../company-billing/company-billing.service';
import { PaymentGatewayService } from '../company-billing/payment-gateway.service';
import { PlatformAuditService } from './platform-audit.service';
import {
  CreateSaasPlanDto,
  CreateSubscriptionPaymentLinkDto,
  CancelSubscriptionPaymentLinkDto,
  CreateSubscriptionInvoiceDto,
  ReportSubscriptionPaymentDto,
  RegisterSubscriptionPaymentDto,
  ReviewPlanChangeRequestDto,
  SubscriptionPaymentLinkQueryDto,
  UpdateSaasPlanDto,
  UpdateSaasPlanStatusDto,
  UpsertCompanySubscriptionDto,
  VoidSubscriptionInvoiceDto,
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

const invoiceInclude = {
  company: { select: { id: true, name: true, status: true, email: true } },
  subscription: { include: subscriptionInclude },
  plan: true,
  payments: {
    include: {
      createdByPlatformUser: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { paidAt: 'desc' },
  },
  createdByPlatformUser: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.SubscriptionInvoiceInclude;

const paymentLinkInclude = {
  invoice: {
    include: {
      company: { select: { id: true, name: true, status: true, email: true } },
      plan: true,
      payments: { orderBy: { paidAt: 'desc' as const } },
    },
  },
  reports: { orderBy: { reportedAt: 'desc' as const } },
  createdByPlatformUser: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.SubscriptionPaymentLinkInclude;

type PaymentLinkWithInclude = Prisma.SubscriptionPaymentLinkGetPayload<{
  include: typeof paymentLinkInclude;
}>;

export interface BillingOverdueProcessResult {
  success: boolean;
  movedToGrace: number;
  movedToGracePeriod: number;
  companiesSuspended: number;
  invoicesOverdue: number;
  noActionRequired: number;
}

@Injectable()
export class PlatformBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  listPlans() {
    return this.prisma.saasPlan.findMany({
      include: planInclude,
      orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { name: 'asc' }],
    });
  }

  paymentProviders() {
    const configuration = this.gateway.configuration();
    return [
      {
        ...configuration,
        provider: 'PAYPAL_CHECKOUT',
        warning: !configuration.webhookConfigured
          ? 'PAYPAL_WEBHOOK_ID puede omitirse en localhost, pero es obligatorio para staging y produccion.'
          : configuration.configured
            ? null
            : configuration.message,
        status: 'NOT_TESTED',
        lastTestAt: null,
      },
    ];
  }

  async testPayPalConnection(
    user: PlatformAuthUser,
    context: PlatformRequestContext,
  ) {
    if (user.role !== PlatformRole.SUPER_ADMIN)
      throw new ForbiddenException('Solo SUPER_ADMIN puede probar PayPal.');
    const result = await this.gateway.testConnection();
    await this.audit.create({
      user,
      action: 'PAYPAL_PROVIDER_CONNECTION_TESTED',
      module: 'platform_billing',
      entityType: 'PaymentProvider',
      entityId: 'PAYPAL_CHECKOUT',
      description: result.reachable
        ? 'Conexion PayPal Sandbox probada correctamente'
        : 'Prueba de conexion PayPal Sandbox fallida',
      metadata: {
        configured: result.configured,
        reachable: result.reachable,
        environment: result.environment,
        testedAt: result.testedAt,
        error: result.error,
      },
      ...context,
    });
    return result;
  }

  async reconcilePayPalCheckouts(
    user: PlatformAuthUser,
    context: PlatformRequestContext,
  ) {
    if (user.role !== PlatformRole.SUPER_ADMIN)
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede reconciliar PayPal.',
      );
    const result = await this.gateway.reconcileExpiredCheckouts();
    await this.audit.create({
      user,
      action: 'PAYPAL_PROVIDER_CHECKOUTS_RECONCILED',
      module: 'platform_billing',
      entityType: 'PaymentProvider',
      entityId: 'PAYPAL_CHECKOUT',
      description: 'Checkouts PayPal pendientes vencidos reconciliados',
      metadata: result,
      ...context,
    });
    return result;
  }

  async listPlanChangeRequests(
    view: 'active' | 'history' | 'reviewed' | 'cancelled' | 'all' = 'active',
  ) {
    const statuses =
      view === 'active'
        ? (['PENDING', 'APPROVED_PENDING_PAYMENT', 'PAYMENT_FAILED'] as const)
        : view === 'history' || view === 'reviewed'
          ? (['APPROVED_APPLIED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const)
          : view === 'cancelled'
            ? (['CANCELLED'] as const)
            : undefined;
    const requests = await this.prisma.planChangeRequest.findMany({
      where: statuses ? { status: { in: [...statuses] } } : undefined,
      include: {
        company: { select: { id: true, name: true, status: true } },
        currentPlan: true,
        requestedPlan: true,
        requestedByUser: { select: { id: true, name: true, email: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            balance: true,
            payments: {
              select: {
                id: true,
                amount: true,
                currency: true,
                reference: true,
                providerCaptureId: true,
                paidAt: true,
              },
              orderBy: { paidAt: 'desc' },
              take: 1,
            },
          },
        },
        checkoutSession: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return requests.map((request) => ({
      ...request,
      requestedBy: request.requestedByUser,
      currentPlanName: request.currentPlan.name,
      requestedPlanName: request.requestedPlan.name,
    }));
  }

  async getPlanChangeRequest(id: string) {
    return this.prisma.planChangeRequest.findUniqueOrThrow({
      where: { id },
      include: {
        company: { select: { id: true, name: true, status: true } },
        currentPlan: true,
        requestedPlan: true,
        requestedByUser: { select: { id: true, name: true, email: true } },
        reviewedByPlatformUser: {
          select: { id: true, name: true, email: true },
        },
        invoice: true,
        checkoutSession: true,
      },
    });
  }

  async approvePlanChangeRequest(
    user: PlatformAuthUser,
    id: string,
    dto: ReviewPlanChangeRequestDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const request = await this.findPlanChangeRequest(id);
    if (request.status !== 'PENDING')
      throw new ConflictException('La solicitud ya fue revisada');
    const plan = await this.prisma.saasPlan.findFirst({
      where: { id: request.requestedPlanId, isActive: true },
    });
    if (!plan)
      throw new BadRequestException('El plan solicitado no esta activo');
    const reviewedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.companySubscription.findUnique({
        where: { companyId: request.companyId },
      });
      if (!subscription) {
        throw new BadRequestException('La empresa no tiene suscripcion');
      }
      const invoiceNumber = await this.nextInvoiceNumber(tx);
      const invoice = await tx.subscriptionInvoice.create({
        data: {
          companyId: request.companyId,
          companySubscriptionId: subscription.id,
          planId: plan.id,
          invoiceNumber,
          subtotal: plan.price,
          total: plan.price,
          balance: plan.price,
          billingPeriodStart: subscription.currentPeriodEnd,
          billingPeriodEnd: this.addBillingInterval(
            subscription.currentPeriodEnd,
            plan.billingInterval,
          ),
          dueDate: new Date(),
          createdByPlatformUserId: user.platformUserId,
        },
      });
      await tx.subscriptionEvent.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId: request.companyId,
          type: SubscriptionEventType.PLAN_ASSIGNED,
          message: `Cambio de plan aprobado: ${plan.name}`,
          metadata: { planChangeRequestId: id, planId: plan.id },
          createdByPlatformUserId: user.platformUserId,
        },
      });
      const updated = await tx.planChangeRequest.update({
        where: { id },
        data: {
          status: 'APPROVED_PENDING_PAYMENT',
          adminNote: dto.adminNote?.trim() ?? null,
          reviewedAt,
          approvedAt: reviewedAt,
          reviewedByPlatformUserId: user.platformUserId,
          invoiceId: invoice.id,
        },
      });
      return { updated, invoice };
    });
    await this.audit.create({
      user,
      action: 'SAAS_PLAN_CHANGE_APPROVED',
      module: 'platform_billing',
      entityType: 'PlanChangeRequest',
      entityId: id,
      description: `Cambio al plan ${plan.name} aprobado`,
      metadata: { companyId: request.companyId, planId: plan.id },
      ...context,
    });
    return {
      request: await this.getPlanChangeRequest(id),
      invoice: result.invoice,
      message: `Solicitud aprobada. La factura ${result.invoice.invoiceNumber} está pendiente de pago.`,
    };
  }

  async rejectPlanChangeRequest(
    user: PlatformAuthUser,
    id: string,
    dto: ReviewPlanChangeRequestDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const request = await this.findPlanChangeRequest(id);
    if (request.status !== 'PENDING')
      throw new ConflictException('La solicitud ya fue revisada');
    const reviewedAt = new Date();
    await this.prisma.planChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNote: dto.adminNote?.trim() ?? null,
        reviewedAt,
        rejectedAt: reviewedAt,
        reviewedByPlatformUserId: user.platformUserId,
      },
    });
    await this.audit.create({
      user,
      action: 'SAAS_PLAN_CHANGE_REJECTED',
      module: 'platform_billing',
      entityType: 'PlanChangeRequest',
      entityId: id,
      description: 'Solicitud de cambio de plan rechazada',
      metadata: { companyId: request.companyId },
      ...context,
    });
    return {
      request: await this.getPlanChangeRequest(id),
      message: 'Solicitud rechazada.',
    };
  }

  async cancelPlanChangeRequest(
    user: PlatformAuthUser,
    id: string,
    dto: ReviewPlanChangeRequestDto,
    context: PlatformRequestContext,
  ) {
    if (user.role !== PlatformRole.SUPER_ADMIN)
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede cancelar administrativamente.',
      );
    const request = await this.findPlanChangeRequest(id);
    if (!['PENDING', 'APPROVED_PENDING_PAYMENT'].includes(request.status))
      throw new ConflictException(
        'Solo se pueden cancelar solicitudes activas sin pago confirmado.',
      );
    if (
      request.checkoutSession?.status === 'PAID' ||
      request.invoice?.status === 'PAID'
    )
      throw new ConflictException(
        'La solicitud tiene un pago confirmado y no puede cancelarse.',
      );
    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (request.checkoutSession)
        await tx.paymentCheckoutSession.update({
          where: { id: request.checkoutSession.id },
          data: { status: 'CANCELLED', cancelledAt },
        });
      if (
        request.invoice &&
        !['PAID', 'VOIDED', 'CANCELLED'].includes(request.invoice.status)
      )
        await tx.subscriptionInvoice.update({
          where: { id: request.invoice.id },
          data: { status: 'CANCELLED' },
        });
      await tx.planChangeRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt,
          reviewedAt: cancelledAt,
          reviewedByPlatformUserId: user.platformUserId,
          adminNote: dto.adminNote?.trim() ?? null,
        },
      });
    });
    await this.audit.create({
      user,
      action: 'SAAS_PLAN_CHANGE_CANCELLED_BY_ADMIN',
      module: 'platform_billing',
      entityType: 'PlanChangeRequest',
      entityId: id,
      description: 'Solicitud cancelada administrativamente',
      metadata: { companyId: request.companyId },
      ...context,
    });
    return {
      request: await this.getPlanChangeRequest(id),
      message: 'Solicitud cancelada.',
    };
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
      const invoice = dto.subscriptionInvoiceId
        ? await tx.subscriptionInvoice.findFirst({
            where: { id: dto.subscriptionInvoiceId, companyId },
          })
        : null;
      if (dto.subscriptionInvoiceId && !invoice) {
        throw new BadRequestException('Factura de suscripcion no encontrada');
      }
      if (
        invoice?.status === SubscriptionInvoiceStatus.PAID ||
        invoice?.status === SubscriptionInvoiceStatus.VOIDED ||
        invoice?.status === SubscriptionInvoiceStatus.CANCELLED
      ) {
        throw new BadRequestException(
          'La factura no admite pagos en su estado actual',
        );
      }
      const payment = await tx.subscriptionPayment.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId,
          subscriptionInvoiceId: invoice?.id,
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
      const updatedInvoice = invoice
        ? await this.applyInvoicePayment(tx, invoice.id, user)
        : null;
      return { invoice: updatedInvoice, payment, subscription: updated };
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
        subscriptionInvoiceId: dto.subscriptionInvoiceId,
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

  listInvoices(status?: SubscriptionInvoiceStatus) {
    return this.prisma.subscriptionInvoice.findMany({
      where: status ? { status } : undefined,
      include: invoiceInclude,
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
      take: 200,
    });
  }

  async getInvoice(id: string) {
    const invoice = await this.prisma.subscriptionInvoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return invoice;
  }

  listInvoicePaymentLinks(
    user: PlatformAuthUser,
    invoiceId: string,
    query: SubscriptionPaymentLinkQueryDto,
  ) {
    this.requireBillingAdmin(user);
    return this.prisma.subscriptionPaymentLink.findMany({
      where: {
        subscriptionInvoiceId: invoiceId,
        status: query.status,
      },
      include: paymentLinkInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createInvoicePaymentLink(
    user: PlatformAuthUser,
    invoiceId: string,
    dto: CreateSubscriptionPaymentLinkDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const invoice = await this.getInvoice(invoiceId);
    if (
      invoice.status === SubscriptionInvoiceStatus.PAID ||
      invoice.status === SubscriptionInvoiceStatus.VOIDED ||
      invoice.status === SubscriptionInvoiceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'La factura no admite links de pago en su estado actual',
      );
    }
    if (!new Prisma.Decimal(invoice.balance).greaterThan(0)) {
      throw new BadRequestException('La factura no tiene balance pendiente');
    }

    const link = await this.prisma.subscriptionPaymentLink.create({
      data: {
        companyId: invoice.companyId,
        subscriptionInvoiceId: invoice.id,
        token: this.paymentLinkToken(),
        status: SubscriptionPaymentLinkStatus.ACTIVE,
        amount: invoice.balance,
        currency: invoice.currency,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadataJson: this.jsonOrUndefined(dto.metadata),
        createdByPlatformUserId: user.platformUserId,
      },
      include: paymentLinkInclude,
    });
    await this.audit.create({
      user,
      action: 'SUBSCRIPTION_PAYMENT_LINK_CREATED',
      module: 'platform_billing',
      entityType: 'SubscriptionPaymentLink',
      entityId: link.id,
      description: `Link de pago creado para ${invoice.invoiceNumber}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.balance.toString(),
        expiresAt: link.expiresAt?.toISOString() ?? null,
      },
      ...context,
    });
    return link;
  }

  async cancelInvoicePaymentLink(
    user: PlatformAuthUser,
    id: string,
    dto: CancelSubscriptionPaymentLinkDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const link = await this.prisma.subscriptionPaymentLink.findUnique({
      where: { id },
      include: paymentLinkInclude,
    });
    if (!link) throw new NotFoundException('Link de pago no encontrado');
    if (link.status === SubscriptionPaymentLinkStatus.CANCELLED) return link;
    if (link.status === SubscriptionPaymentLinkStatus.PAID) {
      throw new BadRequestException('No se puede cancelar un link pagado');
    }
    const cancelled = await this.prisma.subscriptionPaymentLink.update({
      where: { id },
      data: {
        status: SubscriptionPaymentLinkStatus.CANCELLED,
        metadataJson: this.mergeMetadata(link.metadataJson, {
          cancelledReason: dto.reason?.trim() ?? null,
          cancelledAt: new Date().toISOString(),
        }),
      },
      include: paymentLinkInclude,
    });
    await this.audit.create({
      user,
      action: 'SUBSCRIPTION_PAYMENT_LINK_CANCELLED',
      module: 'platform_billing',
      entityType: 'SubscriptionPaymentLink',
      entityId: cancelled.id,
      description: `Link de pago cancelado para ${cancelled.invoice.invoiceNumber}`,
      metadata: { reason: dto.reason?.trim() ?? null },
      ...context,
    });
    return cancelled;
  }

  async getPublicPaymentLink(token: string) {
    const link = await this.findPaymentLinkByToken(token);
    return {
      ...this.publicPaymentLinkResponse(await this.syncPaymentLinkStatus(link)),
      paymentInstructions: MANUAL_PAYMENT_INSTRUCTIONS,
    };
  }

  async reportPublicPayment(
    token: string,
    dto: ReportSubscriptionPaymentDto,
    context: PlatformRequestContext,
  ) {
    const link = await this.syncPaymentLinkStatus(
      await this.findPaymentLinkByToken(token),
    );
    if (link.status !== SubscriptionPaymentLinkStatus.ACTIVE) {
      throw new BadRequestException('El link de pago no esta activo');
    }
    const balance = new Prisma.Decimal(link.invoice.balance);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.greaterThan(balance)) {
      throw new BadRequestException(
        'El monto reportado no puede exceder el balance pendiente',
      );
    }
    const report = await this.prisma.subscriptionPaymentReport.create({
      data: {
        companyId: link.companyId,
        subscriptionInvoiceId: link.subscriptionInvoiceId,
        paymentLinkId: link.id,
        amount,
        currency: link.currency,
        payerName: dto.payerName?.trim(),
        payerEmail: dto.payerEmail?.trim(),
        reference: dto.reference?.trim(),
        notes: dto.notes?.trim(),
      },
    });
    await this.audit.create({
      user: null,
      action: 'SUBSCRIPTION_PAYMENT_REPORTED',
      module: 'platform_billing',
      entityType: 'SubscriptionPaymentReport',
      entityId: report.id,
      description: `Pago reportado para ${link.invoice.invoiceNumber}`,
      metadata: {
        paymentLinkId: link.id,
        invoiceId: link.invoice.id,
        invoiceNumber: link.invoice.invoiceNumber,
        amount: amount.toString(),
      },
      ...context,
    });
    return {
      report,
      link: {
        ...this.publicPaymentLinkResponse(
          await this.findPaymentLinkByToken(token),
        ),
        paymentInstructions: MANUAL_PAYMENT_INSTRUCTIONS,
      },
    };
  }

  listCompanyInvoices(companyId: string) {
    return this.prisma.subscriptionInvoice.findMany({
      where: { companyId },
      include: invoiceInclude,
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
      take: 100,
    });
  }

  async createInvoice(
    user: PlatformAuthUser,
    dto: CreateSubscriptionInvoiceDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const company = await this.ensureCompany(dto.companyId);
    const subscription = dto.companySubscriptionId
      ? await this.prisma.companySubscription.findFirst({
          where: {
            id: dto.companySubscriptionId,
            companyId: company.id,
          },
          include: { plan: true },
        })
      : null;
    const effectiveSubscription =
      subscription ??
      (await this.prisma.companySubscription.findUnique({
        where: { companyId: company.id },
        include: { plan: true },
      }));
    if (!effectiveSubscription) {
      throw new BadRequestException('La empresa no tiene suscripcion');
    }
    if (dto.planId && dto.planId !== effectiveSubscription.planId) {
      throw new BadRequestException(
        'El plan indicado no coincide con la suscripcion',
      );
    }

    const subtotal = this.decimal(
      dto.subtotal ?? effectiveSubscription.plan.price,
    );
    const taxAmount = this.decimal(dto.taxAmount ?? 0);
    const discountAmount = this.decimal(dto.discountAmount ?? 0);
    const total = this.decimal(
      dto.total ?? subtotal.plus(taxAmount).minus(discountAmount),
    );
    if (total.lessThan(0)) {
      throw new BadRequestException(
        'El total de la factura no puede ser menor a 0',
      );
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.nextInvoiceNumber(tx);
      const created = await tx.subscriptionInvoice.create({
        data: {
          companyId: company.id,
          companySubscriptionId: effectiveSubscription.id,
          planId: effectiveSubscription.planId,
          invoiceNumber,
          status: dto.status ?? SubscriptionInvoiceStatus.PENDING,
          currency: dto.currency ?? effectiveSubscription.plan.currency,
          subtotal,
          taxAmount,
          discountAmount,
          total,
          amountPaid: 0,
          balance: total,
          billingPeriodStart: new Date(dto.billingPeriodStart),
          billingPeriodEnd: new Date(dto.billingPeriodEnd),
          dueDate: new Date(dto.dueDate),
          notes: dto.notes?.trim(),
          createdByPlatformUserId: user.platformUserId,
        },
        include: invoiceInclude,
      });
      await tx.subscriptionEvent.create({
        data: {
          companySubscriptionId: effectiveSubscription.id,
          companyId: company.id,
          type: SubscriptionEventType.INVOICE_CREATED,
          message: `Factura interna ${invoiceNumber} creada`,
          metadata: { invoiceId: created.id, invoiceNumber },
          createdByPlatformUserId: user.platformUserId,
        },
      });
      return created;
    });

    await this.audit.create({
      user,
      action: 'SUBSCRIPTION_INVOICE_CREATED',
      module: 'platform_billing',
      entityType: 'SubscriptionInvoice',
      entityId: invoice.id,
      description: `Factura interna ${invoice.invoiceNumber} creada`,
      metadata: { companyId: company.id, invoiceNumber: invoice.invoiceNumber },
      ...context,
    });
    return invoice;
  }

  async voidInvoice(
    user: PlatformAuthUser,
    id: string,
    dto: VoidSubscriptionInvoiceDto,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const invoice = await this.getInvoice(id);
    if (invoice.status === SubscriptionInvoiceStatus.PAID) {
      throw new BadRequestException('No se puede anular una factura pagada');
    }
    if (invoice.status === SubscriptionInvoiceStatus.VOIDED) {
      return invoice;
    }
    const voided = await this.prisma.subscriptionInvoice.update({
      where: { id },
      data: {
        status: SubscriptionInvoiceStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: dto.voidReason.trim(),
      },
      include: invoiceInclude,
    });
    await this.createEvent(
      voided.companySubscriptionId,
      voided.companyId,
      SubscriptionEventType.INVOICE_VOIDED,
      `Factura interna ${voided.invoiceNumber} anulada`,
      user,
      { invoiceId: voided.id, invoiceNumber: voided.invoiceNumber },
    );
    await this.audit.create({
      user,
      action: 'SUBSCRIPTION_INVOICE_VOIDED',
      module: 'platform_billing',
      entityType: 'SubscriptionInvoice',
      entityId: voided.id,
      description: `Factura interna ${voided.invoiceNumber} anulada`,
      metadata: { reason: dto.voidReason },
      ...context,
    });
    return voided;
  }

  async markInvoiceOverdue(
    user: PlatformAuthUser,
    id: string,
    context: PlatformRequestContext,
  ) {
    this.requireBillingAdmin(user);
    const invoice = await this.getInvoice(id);
    if (
      invoice.status !== SubscriptionInvoiceStatus.PENDING &&
      invoice.status !== SubscriptionInvoiceStatus.PARTIALLY_PAID
    ) {
      return invoice;
    }
    const overdue = await this.prisma.subscriptionInvoice.update({
      where: { id },
      data: { status: SubscriptionInvoiceStatus.OVERDUE },
      include: invoiceInclude,
    });
    await this.createEvent(
      overdue.companySubscriptionId,
      overdue.companyId,
      SubscriptionEventType.INVOICE_OVERDUE,
      `Factura interna ${overdue.invoiceNumber} marcada como vencida`,
      user,
      { invoiceId: overdue.id, invoiceNumber: overdue.invoiceNumber },
    );
    await this.audit.create({
      user,
      action: 'SUBSCRIPTION_INVOICE_OVERDUE',
      module: 'platform_billing',
      entityType: 'SubscriptionInvoice',
      entityId: overdue.id,
      description: `Factura interna ${overdue.invoiceNumber} marcada como vencida`,
      ...context,
    });
    return overdue;
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

      const invoicesOverdue = await this.markOverdueInvoices(tx, now);

      await tx.platformAuditLog.create({
        data: {
          platformUserId: user?.platformUserId,
          action: 'BILLING_OVERDUE_PROCESS_RUN',
          module: 'platform_billing',
          description: 'Proceso de vencimientos de billing ejecutado',
          metadataJson: {
            movedToGracePeriod,
            companiesSuspended,
            invoicesOverdue,
            noActionRequired: total - movedToGracePeriod - companiesSuspended,
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return {
        success: true,
        movedToGrace: movedToGracePeriod,
        movedToGracePeriod,
        companiesSuspended,
        invoicesOverdue,
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
        invoice: true,
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
        invoice: true,
        subscription: { include: { plan: true } },
        createdByPlatformUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: 100,
    });
  }

  listPaymentReports() {
    return this.prisma.subscriptionPaymentReport.findMany({
      include: {
        company: { select: { id: true, name: true, status: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            balance: true,
          },
        },
        paymentLink: { select: { id: true, token: true, status: true } },
      },
      orderBy: { reportedAt: 'desc' },
      take: 200,
    });
  }

  listSubscriptions() {
    return this.prisma.companySubscription.findMany({
      include: subscriptionInclude,
      orderBy: { nextPaymentDueAt: 'asc' },
      take: 100,
    });
  }

  invoiceMetrics() {
    return this.prisma.subscriptionInvoice.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { balance: true, total: true },
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

  private async findPlanChangeRequest(id: string) {
    const request = await this.prisma.planChangeRequest.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, status: true } },
        currentPlan: true,
        requestedPlan: true,
        requestedByUser: { select: { id: true, name: true, email: true } },
        invoice: true,
        checkoutSession: true,
      },
    });
    if (!request) {
      throw new NotFoundException('Solicitud de cambio de plan no encontrada');
    }
    return request;
  }

  private decimal(value: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(value);
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient) {
    const prefix = 'SAA';
    await tx.subscriptionInvoiceSequence.upsert({
      where: { prefix },
      create: { prefix, nextNumber: 1 },
      update: {},
    });
    const sequence = await tx.subscriptionInvoiceSequence.update({
      where: { prefix },
      data: { nextNumber: { increment: 1 } },
    });
    return `${prefix}-${String(sequence.nextNumber - 1).padStart(6, '0')}`;
  }

  private async applyInvoicePayment(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    user: PlatformAuthUser,
  ) {
    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payments: true },
    });
    const amountPaid = invoice.payments.reduce(
      (total, payment) => total.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    const balance = Prisma.Decimal.max(
      invoice.total.minus(amountPaid),
      new Prisma.Decimal(0),
    );
    const status = amountPaid.greaterThanOrEqualTo(invoice.total)
      ? SubscriptionInvoiceStatus.PAID
      : amountPaid.greaterThan(0)
        ? SubscriptionInvoiceStatus.PARTIALLY_PAID
        : invoice.status;
    const updated = await tx.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid,
        balance,
        paidAt: status === SubscriptionInvoiceStatus.PAID ? new Date() : null,
        status,
      },
      include: invoiceInclude,
    });
    if (status === SubscriptionInvoiceStatus.PAID) {
      await tx.subscriptionPaymentLink.updateMany({
        where: {
          subscriptionInvoiceId: invoiceId,
          status: SubscriptionPaymentLinkStatus.ACTIVE,
        },
        data: { status: SubscriptionPaymentLinkStatus.PAID },
      });
    }
    await tx.subscriptionEvent.create({
      data: {
        companySubscriptionId: updated.companySubscriptionId,
        companyId: updated.companyId,
        type:
          status === SubscriptionInvoiceStatus.PAID
            ? SubscriptionEventType.INVOICE_PAID
            : SubscriptionEventType.INVOICE_PARTIALLY_PAID,
        message:
          status === SubscriptionInvoiceStatus.PAID
            ? `Factura interna ${updated.invoiceNumber} pagada`
            : `Factura interna ${updated.invoiceNumber} parcialmente pagada`,
        metadata: {
          invoiceId: updated.id,
          invoiceNumber: updated.invoiceNumber,
          amountPaid: amountPaid.toString(),
          balance: balance.toString(),
        },
        createdByPlatformUserId: user.platformUserId,
      },
    });
    await tx.platformAuditLog.create({
      data: {
        platformUserId: user.platformUserId,
        action:
          status === SubscriptionInvoiceStatus.PAID
            ? 'SUBSCRIPTION_INVOICE_PAID'
            : 'SUBSCRIPTION_INVOICE_PARTIALLY_PAID',
        module: 'platform_billing',
        entityType: 'SubscriptionInvoice',
        entityId: updated.id,
        description:
          status === SubscriptionInvoiceStatus.PAID
            ? `Factura interna ${updated.invoiceNumber} pagada`
            : `Factura interna ${updated.invoiceNumber} parcialmente pagada`,
        metadataJson: {
          amountPaid: amountPaid.toString(),
          balance: balance.toString(),
        },
      },
    });
    return updated;
  }

  private async markOverdueInvoices(tx: Prisma.TransactionClient, now: Date) {
    const invoices = await tx.subscriptionInvoice.findMany({
      where: {
        status: {
          in: [
            SubscriptionInvoiceStatus.PENDING,
            SubscriptionInvoiceStatus.PARTIALLY_PAID,
          ],
        },
        dueDate: { lt: now },
      },
    });
    if (!invoices.length) return 0;
    await tx.subscriptionInvoice.updateMany({
      where: { id: { in: invoices.map((invoice) => invoice.id) } },
      data: { status: SubscriptionInvoiceStatus.OVERDUE },
    });
    await tx.subscriptionEvent.createMany({
      data: invoices.map((invoice) => ({
        companySubscriptionId: invoice.companySubscriptionId,
        companyId: invoice.companyId,
        type: SubscriptionEventType.INVOICE_OVERDUE,
        message: `Factura interna ${invoice.invoiceNumber} marcada como vencida`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          processedAt: now.toISOString(),
        },
      })),
    });
    await tx.platformAuditLog.createMany({
      data: invoices.map((invoice) => ({
        action: 'SUBSCRIPTION_INVOICE_OVERDUE',
        module: 'platform_billing',
        entityType: 'SubscriptionInvoice',
        entityId: invoice.id,
        description: `Factura interna ${invoice.invoiceNumber} marcada como vencida`,
        metadataJson: {
          invoiceNumber: invoice.invoiceNumber,
          processedAt: now.toISOString(),
        },
      })),
    });
    return invoices.length;
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

  private async findPaymentLinkByToken(token: string) {
    const link = await this.prisma.subscriptionPaymentLink.findUnique({
      where: { token },
      include: paymentLinkInclude,
    });
    if (!link) throw new NotFoundException('Link de pago no encontrado');
    return link;
  }

  private async syncPaymentLinkStatus(
    link: PaymentLinkWithInclude,
  ): Promise<PaymentLinkWithInclude> {
    const nextStatus = this.resolvePaymentLinkStatus(link);
    if (nextStatus === link.status) return link;
    return this.prisma.subscriptionPaymentLink.update({
      where: { id: link.id },
      data: { status: nextStatus },
      include: paymentLinkInclude,
    });
  }

  private resolvePaymentLinkStatus(link: PaymentLinkWithInclude) {
    if (link.status === SubscriptionPaymentLinkStatus.CANCELLED) {
      return link.status;
    }
    if (link.invoice.status === SubscriptionInvoiceStatus.PAID) {
      return SubscriptionPaymentLinkStatus.PAID;
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return SubscriptionPaymentLinkStatus.EXPIRED;
    }
    return link.status;
  }

  private publicPaymentLinkResponse(link: PaymentLinkWithInclude) {
    return {
      token: link.token,
      status: link.status,
      amount: link.amount,
      currency: link.currency,
      expiresAt: link.expiresAt,
      invoice: {
        invoiceNumber: link.invoice.invoiceNumber,
        status: link.invoice.status,
        subtotal: link.invoice.subtotal,
        taxAmount: link.invoice.taxAmount,
        discountAmount: link.invoice.discountAmount,
        total: link.invoice.total,
        amountPaid: link.invoice.amountPaid,
        balance: link.invoice.balance,
        billingPeriodStart: link.invoice.billingPeriodStart,
        billingPeriodEnd: link.invoice.billingPeriodEnd,
        issueDate: link.invoice.issueDate,
        dueDate: link.invoice.dueDate,
        notes: link.invoice.notes,
        company: {
          name: link.invoice.company.name,
          email: link.invoice.company.email,
        },
        plan: { name: link.invoice.plan.name },
      },
      reports: link.reports.map((report) => ({
        id: report.id,
        status: report.status,
        amount: report.amount,
        currency: report.currency,
        reference: report.reference,
        reportedAt: report.reportedAt,
      })),
    };
  }

  private paymentLinkToken() {
    return randomBytes(32).toString('base64url');
  }

  private jsonOrUndefined(value: unknown) {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }

  private mergeMetadata(
    current: Prisma.JsonValue | null,
    patch: Prisma.InputJsonObject,
  ) {
    return {
      ...(current && typeof current === 'object' && !Array.isArray(current)
        ? current
        : {}),
      ...patch,
    } satisfies Prisma.InputJsonObject;
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
