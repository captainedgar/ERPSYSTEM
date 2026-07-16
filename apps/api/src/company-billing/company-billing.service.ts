import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SubscriptionInvoiceStatus,
  SubscriptionPaymentLinkStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CompanyEntitlementsService } from '../company-entitlements/company-entitlements.service';
import {
  STANDARD_SAAS_PLANS,
  type SaasPlanCode,
} from '../company-entitlements/saas-plan-entitlements';

const paymentLinkSelect = {
  id: true,
  token: true,
  status: true,
  amount: true,
  currency: true,
  expiresAt: true,
  reports: {
    select: {
      id: true,
      status: true,
      amount: true,
      reference: true,
      reportedAt: true,
    },
    orderBy: { reportedAt: 'desc' as const },
  },
};

const invoiceFields = {
  id: true,
  companyId: true,
  companySubscriptionId: true,
  planId: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  subtotal: true,
  taxAmount: true,
  discountAmount: true,
  total: true,
  amountPaid: true,
  balance: true,
  billingPeriodStart: true,
  billingPeriodEnd: true,
  issueDate: true,
  dueDate: true,
  paidAt: true,
  voidedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class CompanyBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: CompanyEntitlementsService,
  ) {}

  getSubscription(companyId: string) {
    return this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        company: { select: { id: true, name: true, status: true } },
      },
    });
  }

  listInvoices(companyId: string) {
    return this.prisma.subscriptionInvoice.findMany({
      where: { companyId },
      select: {
        ...invoiceFields,
        plan: { select: { id: true, name: true, billingInterval: true } },
        paymentLinks: {
          where: {
            status: SubscriptionPaymentLinkStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: paymentLinkSelect,
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
      take: 100,
    });
  }

  async getInvoice(companyId: string, id: string) {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id, companyId },
      select: {
        ...invoiceFields,
        plan: { select: { id: true, name: true, billingInterval: true } },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            reference: true,
            paidAt: true,
          },
          orderBy: { paidAt: 'desc' },
        },
        paymentLinks: {
          select: paymentLinkSelect,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Factura SaaS no encontrada');
    return invoice;
  }

  listPayments(companyId: string) {
    return this.prisma.subscriptionPayment.findMany({
      where: { companyId },
      select: {
        id: true,
        subscriptionInvoiceId: true,
        amount: true,
        currency: true,
        method: true,
        reference: true,
        notes: true,
        paidAt: true,
        invoice: {
          select: { id: true, invoiceNumber: true, status: true },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: 100,
    });
  }

  listEvents(companyId: string) {
    return this.prisma.subscriptionEvent.findMany({
      where: { companyId },
      select: { id: true, type: true, message: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  getEntitlements(companyId: string) {
    return this.entitlements.snapshot(companyId);
  }

  async listAvailablePlans() {
    const stored = await this.prisma.saasPlan.findMany({
      where: {
        name: {
          in: Object.values(STANDARD_SAAS_PLANS).map(({ name }) => name),
        },
      },
    });
    const byName = new Map(stored.map((plan) => [plan.name, plan]));
    return Object.values(STANDARD_SAAS_PLANS)
      .filter((plan) => byName.get(plan.name)?.isActive !== false)
      .map((plan) => {
        const configured = byName.get(plan.name);
        const modules =
          configured?.modules &&
          typeof configured.modules === 'object' &&
          !Array.isArray(configured.modules)
            ? (configured.modules as Record<string, unknown>)
            : {};
        return {
          code: plan.code,
          name: configured?.name ?? plan.name,
          description: configured?.description ?? plan.description,
          price: Number(configured?.price ?? plan.price),
          billingInterval: configured?.billingInterval ?? plan.billingInterval,
          maxUsers: configured?.maxUsers ?? plan.maxUsers,
          maxBranches: configured?.maxBranches ?? plan.maxBranches,
          maxProducts:
            typeof modules.maxProducts === 'number'
              ? modules.maxProducts
              : plan.maxProducts,
          features: plan.features.filter(
            (feature) => modules[feature] !== false,
          ),
          customLimits: plan.customLimits ?? false,
        };
      });
  }

  async requestPlanChange(user: AuthUser, planCode: SaasPlanCode) {
    const current = await this.entitlements.snapshot(user.companyId);
    if (current.plan.code === planCode) {
      return { success: true, alreadyCurrent: true, requestedPlan: planCode };
    }
    const requested = STANDARD_SAAS_PLANS[planCode];
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'SAAS_PLAN_CHANGE_REQUESTED',
      module: 'company_billing',
      entityType: 'SaasPlan',
      description: `Cambio solicitado de ${current.plan.name} a ${requested.name}`,
      metadata: {
        currentPlanCode: current.plan.code,
        requestedPlanCode: requested.code,
      },
    });
    return {
      success: true,
      alreadyCurrent: false,
      requestedPlan: requested.code,
      message:
        'Nuestro equipo revisara tu solicitud y actualizara la suscripcion.',
    };
  }

  async getAvailablePaymentLink(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        status: {
          in: [
            SubscriptionInvoiceStatus.PENDING,
            SubscriptionInvoiceStatus.PARTIALLY_PAID,
            SubscriptionInvoiceStatus.OVERDUE,
          ],
        },
      },
      select: { id: true },
    });
    if (!invoice)
      throw new NotFoundException('Factura pendiente no encontrada');

    const link = await this.prisma.subscriptionPaymentLink.findFirst({
      where: {
        companyId,
        subscriptionInvoiceId: invoiceId,
        status: SubscriptionPaymentLinkStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: paymentLinkSelect,
      orderBy: { createdAt: 'desc' },
    });
    if (!link) {
      throw new NotFoundException(
        'No hay un link activo. Solicitalo al equipo de facturacion.',
      );
    }
    return link;
  }
}
