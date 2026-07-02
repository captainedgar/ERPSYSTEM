import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { rethrowCatalogConflict } from '../catalog/catalog-errors';
import { CatalogQueryDto } from '../catalog/dto/catalog-query.dto';
import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser, query: CatalogQueryDto) {
    return this.prisma.brand.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: query.status,
        name: query.search
          ? { contains: query.search.trim(), mode: 'insensitive' }
          : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(user: AuthUser, dto: CreateBrandDto) {
    try {
      const brand = await this.prisma.brand.create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      });
      await this.auditEvent(user, brand.id, 'BRAND_CREATED');
      return brand;
    } catch (error) {
      rethrowCatalogConflict(error, 'Brand name already exists');
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateBrandDto) {
    await this.findOne(user, id);
    try {
      const brand = await this.prisma.brand.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
        },
      });
      await this.auditEvent(user, brand.id, 'BRAND_UPDATED');
      return brand;
    } catch (error) {
      rethrowCatalogConflict(error, 'Brand name already exists');
    }
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateCatalogStatusDto) {
    await this.findOne(user, id);
    const brand = await this.prisma.brand.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.auditEvent(user, brand.id, 'BRAND_UPDATED');
    return brand;
  }

  private auditEvent(user: AuthUser, entityId: string, action: string) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action,
      module: 'brands',
      entityType: 'Brand',
      entityId,
      description: action,
    });
  }
}
