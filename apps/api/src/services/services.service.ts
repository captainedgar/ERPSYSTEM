import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryType, type Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const serviceInclude = {
  category: { select: { id: true, name: true, type: true } },
} satisfies Prisma.ServiceInclude;

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser, query: ServiceQueryDto) {
    return this.prisma.service.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: query.status,
        categoryId: query.categoryId,
        name: query.search
          ? { contains: query.search.trim(), mode: 'insensitive' }
          : undefined,
      },
      include: serviceInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: serviceInclude,
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(user: AuthUser, dto: CreateServiceDto) {
    await this.validateCategory(user.companyId, dto.categoryId);
    const service = await this.prisma.service.create({
      data: {
        companyId: user.companyId,
        ...this.data(dto),
        name: dto.name.trim(),
        price: dto.price,
      },
      include: serviceInclude,
    });
    await this.auditEvent(user, service.id, 'SERVICE_CREATED');
    return service;
  }

  async update(user: AuthUser, id: string, dto: UpdateServiceDto) {
    await this.findOne(user, id);
    await this.validateCategory(user.companyId, dto.categoryId);
    const service = await this.prisma.service.update({
      where: { id },
      data: this.data(dto),
      include: serviceInclude,
    });
    await this.auditEvent(user, service.id, 'SERVICE_UPDATED');
    return service;
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateCatalogStatusDto) {
    await this.findOne(user, id);
    const service = await this.prisma.service.update({
      where: { id },
      data: { status: dto.status },
      include: serviceInclude,
    });
    await this.auditEvent(user, service.id, 'SERVICE_STATUS_CHANGED');
    return service;
  }

  private data(dto: UpdateServiceDto) {
    return {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      categoryId: dto.categoryId,
      price: dto.price,
      taxRate: dto.taxRate,
      durationMinutes: dto.durationMinutes,
      allowDiscount: dto.allowDiscount,
    };
  }

  private async validateCategory(companyId: string, categoryId?: string) {
    if (!categoryId) return;
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        companyId,
        deletedAt: null,
        status: 'ACTIVE',
        type: { in: [CategoryType.SERVICE, CategoryType.BOTH] },
      },
    });
    if (!category) throw new BadRequestException('Invalid service category');
  }

  private auditEvent(user: AuthUser, entityId: string, action: string) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action,
      module: 'services',
      entityType: 'Service',
      entityId,
      description: action,
    });
  }
}
