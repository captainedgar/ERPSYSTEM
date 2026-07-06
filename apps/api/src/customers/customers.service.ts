import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerDocumentType, Prisma, type Customer } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(user: AuthUser, query: CustomerQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const documentSearch = search?.toUpperCase().replace(/[\s-]/g, '');
    const where: Prisma.CustomerWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
      type: query.type,
      documentType: query.documentType,
      status: query.status,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { commercialName: { contains: search, mode: 'insensitive' } },
            {
              documentNumber: {
                contains: documentSearch,
                mode: 'insensitive',
              },
            },
            { phone: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(user: AuthUser, dto: CreateCustomerDto) {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          companyId: user.companyId,
          ...this.customerData(dto),
          type: dto.type,
          name: dto.name.trim(),
          documentType: dto.documentType,
          taxpayerType: dto.taxpayerType,
        },
      });
      await this.audit.create({
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'CUSTOMER_CREATED',
        module: 'customers',
        entityType: 'Customer',
        entityId: customer.id,
        description: `Cliente ${customer.name} creado`,
        metadata: this.auditSnapshot(customer),
      });
      return customer;
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const previous = await this.findOne(user, id);
    const changedFields = Object.keys(dto);
    if (!changedFields.length) {
      throw new BadRequestException('Debes enviar al menos un cambio');
    }

    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: this.customerData(dto),
      });
      await this.audit.create({
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'CUSTOMER_UPDATED',
        module: 'customers',
        entityType: 'Customer',
        entityId: customer.id,
        description: `Cliente ${customer.name} actualizado`,
        metadata: {
          changedFields,
          previous: this.auditSnapshot(previous),
          current: this.auditSnapshot(customer),
        },
      });
      return customer;
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateCustomerStatusDto) {
    const previous = await this.findOne(user, id);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'CUSTOMER_STATUS_CHANGED',
      module: 'customers',
      entityType: 'Customer',
      entityId: customer.id,
      description: `Estado del cliente ${customer.name} actualizado`,
      metadata: { previous: previous.status, current: customer.status },
    });
    return customer;
  }

  private customerData(dto: UpdateCustomerDto | CreateCustomerDto) {
    const email = this.normalizeOptional(dto.email);
    const documentNumber =
      dto.documentType === CustomerDocumentType.NONE
        ? null
        : this.normalizeDocument(dto.documentNumber);

    return {
      type: dto.type,
      name: dto.name?.trim(),
      commercialName: this.normalizeOptional(dto.commercialName),
      documentType: dto.documentType,
      documentNumber,
      email: typeof email === 'string' ? email.toLowerCase() : email,
      phone: this.normalizeOptional(dto.phone),
      mobile: this.normalizeOptional(dto.mobile),
      address: this.normalizeOptional(dto.address),
      city: this.normalizeOptional(dto.city),
      province: this.normalizeOptional(dto.province),
      country: this.normalizeOptional(dto.country),
      taxpayerType: dto.taxpayerType,
      paymentTermsDays: dto.paymentTermsDays,
      creditLimit: dto.creditLimit,
      notes: this.normalizeOptional(dto.notes),
      status: 'status' in dto ? dto.status : undefined,
    };
  }

  private normalizeOptional(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return value.trim() || null;
  }

  private normalizeDocument(value: string | null | undefined) {
    const normalized = this.normalizeOptional(value);
    return typeof normalized === 'string'
      ? normalized.toUpperCase().replace(/[\s-]/g, '')
      : normalized;
  }

  private auditSnapshot(customer: Customer) {
    return {
      type: customer.type,
      documentType: customer.documentType,
      taxpayerType: customer.taxpayerType,
      paymentTermsDays: customer.paymentTermsDays,
      creditLimit: customer.creditLimit.toString(),
      status: customer.status,
    };
  }

  private rethrowConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un cliente con este documento en la empresa',
      );
    }
    throw error;
  }
}
