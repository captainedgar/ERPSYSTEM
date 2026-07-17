import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  PlanChangeRequestStatus,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentLinkStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CompanyEntitlementsService } from '../company-entitlements/company-entitlements.service';
import {
  STANDARD_SAAS_PLANS,
  planModules,
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

export const MANUAL_PAYMENT_INSTRUCTIONS = {
  methods: [
    {
      code: 'BANK_TRANSFER',
      name: 'Transferencia bancaria',
      bank: 'Banco comercial de referencia',
      accountHolder: 'Comercia ERP',
      taxId: 'Disponible al solicitar factura',
      accountNumber: 'Cuenta terminada en 0000',
      currency: 'DOP',
      instructions:
        'Incluye el numero de factura en la referencia y reporta el pago mediante el link publico.',
    },
    {
      code: 'BANK_DEPOSIT',
      name: 'Deposito bancario',
      instructions:
        'Conserva el comprobante y reporta la referencia para validacion manual.',
    },
    {
      code: 'PUBLIC_PAYMENT_REPORT',
      name: 'Reporte por link publico',
      instructions:
        'El reporte no aprueba el pago automaticamente; Platform Admin debe revisarlo.',
    },
  ],
  billingContact: {
    email: 'facturacion@comerciaerp.local',
    whatsapp: 'Disponible mediante soporte comercial',
  },
  card: {
    available: false,
    label: 'Tarjeta de credito/debito - Proximamente',
    notice:
      'El pago con tarjeta se habilitara mediante pasarela tokenizada. Comercia ERP no almacenara numeros de tarjeta ni CVV.',
  },
} as const;

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

  getPaymentInstructions() {
    return MANUAL_PAYMENT_INSTRUCTIONS;
  }

  async listPlanChangeRequests(companyId: string) {
    const requests = await this.prisma.planChangeRequest.findMany({
      where: { companyId },
      include: {
        currentPlan: { select: { id: true, name: true } },
        requestedPlan: { select: { id: true, name: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            balance: true,
          },
        },
        checkoutSession: {
          select: { id: true, status: true, checkoutUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return requests.map((request) => ({
      ...request,
      currentPlanName: request.currentPlan.name,
      requestedPlanName: request.requestedPlan.name,
      requestedBy: request.requestedByUser,
    }));
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
    const pending = await this.prisma.planChangeRequest.findFirst({
      where: {
        companyId: user.companyId,
        status: {
          in: [
            PlanChangeRequestStatus.PENDING,
            PlanChangeRequestStatus.APPROVED_PENDING_PAYMENT,
            PlanChangeRequestStatus.PAYMENT_FAILED,
          ],
        },
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'Ya existe una solicitud de cambio de plan pendiente.',
      );
    }
    const storedPlan = await this.prisma.saasPlan.upsert({
      where: { name: requested.name },
      update: {},
      create: {
        name: requested.name,
        description: requested.description,
        price: requested.price,
        currency: Currency.DOP,
        billingInterval: requested.billingInterval,
        graceDays: requested.graceDays,
        maxUsers: requested.maxUsers,
        maxBranches: requested.maxBranches,
        modules: planModules(requested),
      },
      select: { id: true, isActive: true },
    });
    if (!storedPlan.isActive) {
      throw new NotFoundException('El plan solicitado no esta disponible.');
    }
    const log = await this.prisma.$transaction(async (tx) => {
      const created = await tx.planChangeRequest.create({
        data: {
          companyId: user.companyId,
          currentPlanId: current.plan.id,
          requestedPlanId: storedPlan.id,
          requestedByUserId: user.userId,
        },
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'SAAS_PLAN_CHANGE_REQUESTED',
        module: 'company_billing',
        entityType: 'PlanChangeRequest',
        entityId: created.id,
        description: `Cambio solicitado de ${current.plan.name} a ${requested.name}`,
        metadata: {
          requestedPlanId: storedPlan.id,
          requestedPlanCode: requested.code,
        },
      });
      return created;
    });
    return {
      success: true,
      alreadyCurrent: false,
      id: log.id,
      status: 'PENDING',
      requestedPlan: requested.code,
      message:
        'Solicitud enviada. El equipo de Comercia ERP revisara el cambio de plan.',
      createdAt: log.createdAt,
    };
  }

  async cancelPlanChangeRequest(user: AuthUser, id: string) {
    const request = await this.prisma.planChangeRequest.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!request) {
      throw new NotFoundException('Solicitud de cambio de plan no encontrada.');
    }
    if (request.status !== PlanChangeRequestStatus.PENDING) {
      throw new ConflictException(
        'Solo se pueden cancelar solicitudes pendientes.',
      );
    }
    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.planChangeRequest.update({
        where: { id },
        data: { status: PlanChangeRequestStatus.CANCELLED, cancelledAt },
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'SAAS_PLAN_CHANGE_CANCELLED',
        module: 'company_billing',
        entityType: 'PlanChangeRequest',
        entityId: id,
        description: 'Solicitud de cambio de plan cancelada por el cliente',
        metadata: { planChangeRequestId: id },
      });
    });
    return {
      id,
      status: 'CANCELLED',
      message: 'Solicitud de cambio de plan cancelada.',
      cancelledAt,
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
