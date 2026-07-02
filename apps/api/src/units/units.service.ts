import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { rethrowCatalogConflict } from '../catalog/catalog-errors';
import { CatalogQueryDto } from '../catalog/dto/catalog-query.dto';
import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser, query: CatalogQueryDto) {
    return this.prisma.unit.findMany({
      where: {
        companyId: user.companyId,
        status: query.status,
        name: query.search
          ? { contains: query.search.trim(), mode: 'insensitive' }
          : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async create(user: AuthUser, dto: CreateUnitDto) {
    try {
      const unit = await this.prisma.unit.create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          code: dto.code.toUpperCase(),
          allowsDecimals: dto.allowsDecimals,
        },
      });
      await this.auditEvent(user, unit.id, 'UNIT_CREATED');
      return unit;
    } catch (error) {
      rethrowCatalogConflict(error, 'Unit name or code already exists');
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateUnitDto) {
    await this.findOne(user, id);
    try {
      const unit = await this.prisma.unit.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code?.toUpperCase(),
          allowsDecimals: dto.allowsDecimals,
        },
      });
      await this.auditEvent(user, unit.id, 'UNIT_UPDATED');
      return unit;
    } catch (error) {
      rethrowCatalogConflict(error, 'Unit name or code already exists');
    }
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateCatalogStatusDto) {
    await this.findOne(user, id);
    const unit = await this.prisma.unit.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.auditEvent(user, unit.id, 'UNIT_UPDATED');
    return unit;
  }

  private auditEvent(user: AuthUser, entityId: string, action: string) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action,
      module: 'units',
      entityType: 'Unit',
      entityId,
      description: action,
    });
  }
}
