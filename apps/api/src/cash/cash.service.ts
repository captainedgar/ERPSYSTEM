import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BranchStatus,
  CashMovementType,
  CashSessionStatus,
  PaymentMethod,
  Prisma,
  UserRole,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CashSessionsQueryDto } from './dto/cash-sessions-query.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { ManualCashMovementDto } from './dto/manual-cash-movement.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

const cashSessionSummaryInclude = {
  branch: { select: { id: true, code: true, name: true } },
  openedBy: { select: { id: true, name: true, email: true } },
  closedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CashSessionInclude;

const cashSessionDetailInclude = {
  ...cashSessionSummaryInclude,
  movements: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      sale: { select: { id: true, saleNumber: true, status: true } },
    },
  },
  sales: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    select: {
      id: true,
      saleNumber: true,
      status: true,
      total: true,
      createdAt: true,
    },
  },
} satisfies Prisma.CashSessionInclude;

export class CashRequiredForSaleError extends Error {
  constructor() {
    super('Cash session required for sale');
  }
}

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async current(user: AuthUser) {
    if (!user.branchId) return null;
    return this.prisma.cashSession.findFirst({
      where: {
        companyId: user.companyId,
        branchId: user.branchId,
        openedById: user.userId,
        status: CashSessionStatus.OPEN,
      },
      include: cashSessionSummaryInclude,
      orderBy: { openedAt: 'desc' },
    });
  }

  async findAll(user: AuthUser, query: CashSessionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CashSessionWhereInput = {
      companyId: user.companyId,
      status: query.status,
      branchId: user.branchId ?? query.branchId,
      openedAt:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom
                ? this.dateBoundary(query.dateFrom, false)
                : undefined,
              lte: query.dateTo
                ? this.dateBoundary(query.dateTo, true)
                : undefined,
            }
          : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashSession.findMany({
        where,
        include: cashSessionSummaryInclude,
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cashSession.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(user: AuthUser, id: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        id,
        companyId: user.companyId,
        branchId: user.branchId ?? undefined,
      },
      include: cashSessionDetailInclude,
    });
    if (!session) throw new NotFoundException('Caja no encontrada');
    return session;
  }

  async open(user: AuthUser, dto: OpenCashSessionDto) {
    if (!user.branchId || user.branchId !== dto.branchId) {
      throw new BadRequestException(
        'Solo puedes abrir caja en tu sucursal asignada',
      );
    }
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const lockKey = `${user.companyId}:${dto.branchId}:${user.userId}`;
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`,
        );
        const branch = await tx.branch.findFirst({
          where: {
            id: dto.branchId,
            companyId: user.companyId,
            status: BranchStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!branch) {
          throw new BadRequestException('La sucursal no está disponible');
        }
        const existing = await tx.cashSession.findFirst({
          where: {
            companyId: user.companyId,
            branchId: branch.id,
            openedById: user.userId,
            status: CashSessionStatus.OPEN,
          },
          select: { id: true },
        });
        if (existing) {
          throw new BadRequestException(
            'Ya tienes una caja abierta en esta sucursal',
          );
        }
        const session = await tx.cashSession.create({
          data: {
            companyId: user.companyId,
            branchId: branch.id,
            openedById: user.userId,
            openingAmount: dto.openingAmount,
            expectedCashAmount: dto.openingAmount,
            notes: this.optional(dto.notes),
          },
          select: { id: true },
        });
        await tx.cashMovement.create({
          data: {
            companyId: user.companyId,
            branchId: branch.id,
            cashSessionId: session.id,
            type: CashMovementType.OPENING,
            amount: dto.openingAmount,
            reason: 'Apertura de caja',
            referenceType: 'CashSession',
            referenceId: session.id,
            createdById: user.userId,
          },
        });
        await this.audit.createWithClient(tx, {
          companyId: user.companyId,
          branchId: branch.id,
          userId: user.userId,
          action: 'CASH_SESSION_OPENED',
          module: 'cash',
          entityType: 'CashSession',
          entityId: session.id,
          description: 'Caja abierta',
          metadata: {
            cashSessionId: session.id,
            openingAmount: dto.openingAmount,
          },
        });
        return session.id;
      });
      return this.findOne(user, id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Ya tienes una caja abierta en esta sucursal',
        );
      }
      throw error;
    }
  }

  async close(user: AuthUser, dto: CloseCashSessionDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockOpenSession(tx, user, dto.cashSessionId);
      const totals = await this.calculateTotals(tx, session);
      const counted = this.decimal(dto.countedCashAmount);
      const difference = counted.sub(totals.expected);
      const updated = await tx.cashSession.updateMany({
        where: {
          id: session.id,
          companyId: user.companyId,
          status: CashSessionStatus.OPEN,
        },
        data: {
          status: CashSessionStatus.CLOSED,
          closedById: user.userId,
          closedAt: new Date(),
          countedCashAmount: counted,
          differenceAmount: difference,
          expectedCashAmount: totals.expected,
          salesCashTotal: totals.salesCash,
          manualInTotal: totals.manualIn,
          manualOutTotal: totals.manualOut,
          notes: this.optional(dto.notes) ?? session.notes,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('La caja ya no puede cerrarse');
      }
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: session.branchId,
        userId: user.userId,
        action: 'CASH_SESSION_CLOSED',
        module: 'cash',
        entityType: 'CashSession',
        entityId: session.id,
        description: 'Caja cerrada',
        metadata: {
          cashSessionId: session.id,
          expectedCashAmount: totals.expected.toString(),
          countedCashAmount: counted.toString(),
          differenceAmount: difference.toString(),
        },
      });
      return session.id;
    });
    return this.findOne(user, id);
  }

  async manualMovement(
    user: AuthUser,
    dto: ManualCashMovementDto,
    type: 'MANUAL_IN' | 'MANUAL_OUT',
  ) {
    const id = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockOpenSession(tx, user, dto.cashSessionId);
      if (type === CashMovementType.MANUAL_OUT) {
        const settings = await tx.businessSettings.findUniqueOrThrow({
          where: { companyId: user.companyId },
          select: { cashAllowExpenses: true },
        });
        if (!settings.cashAllowExpenses) {
          throw new BadRequestException(
            'La configuración no permite salidas manuales de caja',
          );
        }
      }
      const amount = this.decimal(dto.amount);
      const movement = await tx.cashMovement.create({
        data: {
          companyId: user.companyId,
          branchId: session.branchId,
          cashSessionId: session.id,
          type,
          amount,
          reason: dto.reason.trim(),
          createdById: user.userId,
        },
      });
      await tx.cashSession.update({
        where: { id: session.id },
        data:
          type === CashMovementType.MANUAL_IN
            ? {
                manualInTotal: { increment: amount },
                expectedCashAmount: { increment: amount },
              }
            : {
                manualOutTotal: { increment: amount },
                expectedCashAmount: { decrement: amount },
              },
      });
      await this.audit.createWithClient(tx, {
        companyId: user.companyId,
        branchId: session.branchId,
        userId: user.userId,
        action:
          type === CashMovementType.MANUAL_IN
            ? 'CASH_MANUAL_IN'
            : 'CASH_MANUAL_OUT',
        module: 'cash',
        entityType: 'CashMovement',
        entityId: movement.id,
        description:
          type === CashMovementType.MANUAL_IN
            ? 'Entrada manual de caja'
            : 'Salida manual de caja',
        metadata: {
          cashSessionId: session.id,
          amount: amount.toString(),
          reason: dto.reason.trim(),
        },
      });
      return session.id;
    });
    return this.findOne(user, id);
  }

  async resolveSessionForSale(tx: Prisma.TransactionClient, user: AuthUser) {
    const settings = await tx.businessSettings.findUniqueOrThrow({
      where: { companyId: user.companyId },
      select: { requireOpenCashForSales: true },
    });
    if (!user.branchId) {
      if (settings.requireOpenCashForSales) {
        throw new CashRequiredForSaleError();
      }
      return null;
    }
    const candidate = await tx.cashSession.findFirst({
      where: {
        companyId: user.companyId,
        branchId: user.branchId,
        openedById: user.userId,
        status: CashSessionStatus.OPEN,
      },
      select: { id: true },
    });
    if (!candidate) {
      if (settings.requireOpenCashForSales) {
        throw new CashRequiredForSaleError();
      }
      return null;
    }
    return this.lockOpenSession(tx, user, candidate.id);
  }

  async registerSaleCashPayment(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    cashSessionId: string | null,
    saleId: string,
    payments: Array<{ method: PaymentMethod; amount: number }>,
  ) {
    if (!cashSessionId) return;
    const cashAmount = payments
      .filter(({ method }) => method === PaymentMethod.CASH)
      .reduce(
        (total, payment) => total.add(payment.amount),
        new Prisma.Decimal(0),
      );
    if (!cashAmount.isPositive()) return;
    const movement = await tx.cashMovement.create({
      data: {
        companyId: user.companyId,
        branchId: user.branchId!,
        cashSessionId,
        type: CashMovementType.SALE_CASH_IN,
        amount: cashAmount,
        reason: 'Pago en efectivo de venta',
        referenceType: 'Sale',
        referenceId: saleId,
        saleId,
        createdById: user.userId,
      },
    });
    await tx.cashSession.update({
      where: { id: cashSessionId },
      data: {
        salesCashTotal: { increment: cashAmount },
        expectedCashAmount: { increment: cashAmount },
      },
    });
    await this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'CASH_SALE_PAYMENT_REGISTERED',
      module: 'cash',
      entityType: 'CashMovement',
      entityId: movement.id,
      description: 'Pago en efectivo registrado en caja',
      metadata: {
        cashSessionId,
        saleId,
        amount: cashAmount.toString(),
      },
    });
  }

  async reverseSaleCashPayment(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    sale: {
      id: string;
      branchId: string;
      saleNumber: string;
      cashSessionId: string | null;
    },
    reason: string,
  ) {
    if (!sale.cashSessionId) return;
    const original = await tx.cashMovement.aggregate({
      where: {
        companyId: user.companyId,
        cashSessionId: sale.cashSessionId,
        saleId: sale.id,
        type: CashMovementType.SALE_CASH_IN,
      },
      _sum: { amount: true },
    });
    const amount = original._sum.amount;
    if (!amount?.isPositive()) return;
    const originalSession = await tx.cashSession.findFirst({
      where: {
        id: sale.cashSessionId,
        companyId: user.companyId,
        status: CashSessionStatus.OPEN,
      },
      select: { id: true },
    });
    const targetSession =
      originalSession ??
      (await tx.cashSession.findFirst({
        where: {
          companyId: user.companyId,
          branchId: sale.branchId,
          openedById: user.userId,
          status: CashSessionStatus.OPEN,
        },
        select: { id: true },
      }));
    if (!targetSession) {
      throw new BadRequestException(
        'Debes abrir una caja para registrar la devolución en efectivo',
      );
    }
    const lockedSession = await this.lockOpenSession(
      tx,
      user,
      targetSession.id,
    );
    const existing = await tx.cashMovement.findFirst({
      where: {
        companyId: user.companyId,
        saleId: sale.id,
        type: CashMovementType.SALE_CANCELLED_OUT,
      },
      select: { id: true },
    });
    if (existing) return;
    const movement = await tx.cashMovement.create({
      data: {
        companyId: user.companyId,
        branchId: lockedSession.branchId,
        cashSessionId: lockedSession.id,
        type: CashMovementType.SALE_CANCELLED_OUT,
        amount,
        reason,
        referenceType: 'Sale',
        referenceId: sale.id,
        saleId: sale.id,
        createdById: user.userId,
      },
    });
    await tx.cashSession.update({
      where: { id: lockedSession.id },
      data: { expectedCashAmount: { decrement: amount } },
    });
    await this.audit.createWithClient(tx, {
      companyId: user.companyId,
      branchId: lockedSession.branchId,
      userId: user.userId,
      action: 'CASH_SALE_CANCELLED_REVERSED',
      module: 'cash',
      entityType: 'CashMovement',
      entityId: movement.id,
      description: `Efectivo revertido por anulación de ${sale.saleNumber}`,
      metadata: {
        cashSessionId: lockedSession.id,
        originalCashSessionId: sale.cashSessionId,
        saleId: sale.id,
        amount: amount.toString(),
        reason,
      },
    });
  }

  private async lockOpenSession(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    id: string,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "cash_sessions" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`,
    );
    const session = await tx.cashSession.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!session) throw new NotFoundException('Caja no encontrada');
    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('La caja está cerrada');
    }
    if (
      user.roleCode !== UserRole.OWNER &&
      user.roleCode !== UserRole.ADMIN &&
      session.openedById !== user.userId
    ) {
      throw new BadRequestException(
        'Solo puedes operar tu propia caja abierta',
      );
    }
    return session;
  }

  private async calculateTotals(
    tx: Prisma.TransactionClient,
    session: {
      id: string;
      openingAmount: Prisma.Decimal;
    },
  ) {
    const movements = await tx.cashMovement.findMany({
      where: { cashSessionId: session.id },
      select: { type: true, amount: true },
    });
    let salesCash = new Prisma.Decimal(0);
    let manualIn = new Prisma.Decimal(0);
    let manualOut = new Prisma.Decimal(0);
    let adjustmentIn = new Prisma.Decimal(0);
    let adjustmentOut = new Prisma.Decimal(0);
    let cancelledSales = new Prisma.Decimal(0);
    for (const movement of movements) {
      if (movement.type === CashMovementType.SALE_CASH_IN) {
        salesCash = salesCash.add(movement.amount);
      } else if (movement.type === CashMovementType.MANUAL_IN) {
        manualIn = manualIn.add(movement.amount);
      } else if (movement.type === CashMovementType.MANUAL_OUT) {
        manualOut = manualOut.add(movement.amount);
      } else if (movement.type === CashMovementType.ADJUSTMENT_IN) {
        adjustmentIn = adjustmentIn.add(movement.amount);
      } else if (movement.type === CashMovementType.ADJUSTMENT_OUT) {
        adjustmentOut = adjustmentOut.add(movement.amount);
      } else if (movement.type === CashMovementType.SALE_CANCELLED_OUT) {
        cancelledSales = cancelledSales.add(movement.amount);
      }
    }
    const expected = session.openingAmount
      .add(salesCash)
      .add(manualIn)
      .add(adjustmentIn)
      .sub(manualOut)
      .sub(adjustmentOut)
      .sub(cancelledSales);
    return { salesCash, manualIn, manualOut, expected };
  }

  private dateBoundary(value: string, endOfDay: boolean) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(
        `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`,
      );
    }
    return new Date(value);
  }

  private decimal(value: Prisma.Decimal | number | string) {
    return new Prisma.Decimal(value).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
  }

  private optional(value: string | undefined) {
    return value?.trim() || undefined;
  }
}
