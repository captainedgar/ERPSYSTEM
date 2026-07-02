import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { rethrowCatalogConflict } from '../catalog/catalog-errors';
import { UpdateCatalogStatusDto } from '../catalog/dto/update-catalog-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser, query: CategoryQueryDto) {
    return this.prisma.category.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        status: query.status,
        type: query.type,
        name: query.search
          ? { contains: query.search.trim(), mode: 'insensitive' }
          : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(user: AuthUser, dto: CreateCategoryDto) {
    try {
      const category = await this.prisma.category.create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          type: dto.type,
          description: dto.description?.trim(),
        },
      });
      await this.auditEvent(user, category.id, 'CATEGORY_CREATED');
      return category;
    } catch (error) {
      rethrowCatalogConflict(error, 'Category name already exists');
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateCategoryDto) {
    await this.findOne(user, id);
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          type: dto.type,
          description: dto.description?.trim(),
        },
      });
      await this.auditEvent(user, category.id, 'CATEGORY_UPDATED');
      return category;
    } catch (error) {
      rethrowCatalogConflict(error, 'Category name already exists');
    }
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateCatalogStatusDto) {
    await this.findOne(user, id);
    const category = await this.prisma.category.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.auditEvent(user, category.id, 'CATEGORY_UPDATED');
    return category;
  }

  private auditEvent(user: AuthUser, entityId: string, action: string) {
    return this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action,
      module: 'categories',
      entityType: 'Category',
      entityId,
      description: action,
    });
  }
}
