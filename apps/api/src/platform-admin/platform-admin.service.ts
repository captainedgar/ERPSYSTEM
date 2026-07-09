import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyStatus, PlatformRole, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { UpdatePlatformCompanyStatusDto } from './update-platform-company-status.dto';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';

const companySummarySelect = {
  id: true,
  name: true,
  legalName: true,
  rncOrCedula: true,
  email: true,
  phone: true,
  businessType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, branches: true, sales: true } },
} satisfies Prisma.CompanySelect;

const companyDetailSelect = {
  ...companySummarySelect,
  address: true,
  settings: {
    select: {
      currency: true,
      onboardingCompleted: true,
      defaultDocumentType: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  fiscalSettings: {
    select: {
      enabled: true,
      environment: true,
      providerMode: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.CompanySelect;

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async listCompanies(search?: string) {
    const trimmed = search?.trim();
    return this.prisma.company.findMany({
      where: {
        deletedAt: null,
        OR: trimmed
          ? [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { legalName: { contains: trimmed, mode: 'insensitive' } },
              { email: { contains: trimmed, mode: 'insensitive' } },
              { rncOrCedula: { contains: trimmed.replace(/[\s-]/g, '') } },
            ]
          : undefined,
      },
      select: companySummarySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  async getCompany(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: companyDetailSelect,
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  async listCompanyUsers(companyId: string) {
    await this.ensureCompany(companyId);
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, code: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateCompanyStatus(
    user: PlatformAuthUser,
    companyId: string,
    dto: UpdatePlatformCompanyStatusDto,
    context: PlatformRequestContext,
  ) {
    if (user.role !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Solo SUPER_ADMIN puede cambiar estados');
    }
    if (
      dto.status !== CompanyStatus.ACTIVE &&
      dto.status !== CompanyStatus.SUSPENDED
    ) {
      throw new BadRequestException('Solo se permite activar o suspender');
    }
    const company = await this.ensureCompany(companyId);
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: { status: dto.status },
      select: companyDetailSelect,
    });
    await this.audit.create({
      user,
      action:
        dto.status === CompanyStatus.SUSPENDED
          ? 'PLATFORM_COMPANY_SUSPENDED'
          : 'PLATFORM_COMPANY_REACTIVATED',
      module: 'platform_companies',
      entityType: 'Company',
      entityId: company.id,
      description: `Estado de empresa actualizado a ${dto.status}`,
      metadata: { previousStatus: company.status, nextStatus: dto.status },
      ...context,
    });
    return updated;
  }

  async getGlobalMetrics() {
    const [
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      salesAggregate,
      internalDocuments,
      electronicInvoices,
      fiscalErrors,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.company.count({
        where: { deletedAt: null, status: CompanyStatus.ACTIVE },
      }),
      this.prisma.company.count({
        where: { deletedAt: null, status: CompanyStatus.SUSPENDED },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.sale.aggregate({ _sum: { total: true }, _count: true }),
      this.prisma.internalDocument.count(),
      this.prisma.electronicInvoice.count(),
      this.prisma.fiscalError.count(),
    ]);
    return {
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      totalSalesAmount: salesAggregate._sum.total ?? 0,
      totalSales: salesAggregate._count,
      internalDocuments,
      electronicInvoices,
      fiscalErrors,
    };
  }

  async getCompanyMetrics(companyId: string) {
    await this.ensureCompany(companyId);
    const [
      users,
      branches,
      products,
      customers,
      salesAggregate,
      internalDocuments,
      electronicInvoices,
      fiscalErrors,
    ] = await Promise.all([
      this.prisma.user.count({ where: { companyId, deletedAt: null } }),
      this.prisma.branch.count({ where: { companyId, deletedAt: null } }),
      this.prisma.product.count({ where: { companyId, deletedAt: null } }),
      this.prisma.customer.count({ where: { companyId, deletedAt: null } }),
      this.prisma.sale.aggregate({
        where: { companyId },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.internalDocument.count({ where: { companyId } }),
      this.prisma.electronicInvoice.count({ where: { companyId } }),
      this.prisma.fiscalError.count({ where: { companyId } }),
    ]);
    return {
      companyId,
      users,
      branches,
      products,
      customers,
      totalSalesAmount: salesAggregate._sum.total ?? 0,
      totalSales: salesAggregate._count,
      internalDocuments,
      electronicInvoices,
      fiscalErrors,
    };
  }

  listAuditLogs() {
    return this.prisma.platformAuditLog.findMany({
      select: {
        id: true,
        action: true,
        module: true,
        entityType: true,
        entityId: true,
        description: true,
        metadataJson: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        platformUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async ensureCompany(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }
}
