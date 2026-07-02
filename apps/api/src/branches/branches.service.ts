import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser) {
    return this.prisma.branch.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });
  }

  async create(user: AuthUser, dto: CreateBranchDto) {
    const branch = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await tx.branch.updateMany({
          where: { companyId: user.companyId, isMain: true },
          data: { isMain: false },
        });
      }
      return tx.branch.create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          code: dto.code.toUpperCase(),
          phone: dto.phone?.trim(),
          address: dto.address?.trim(),
          isMain: dto.isMain ?? false,
        },
      });
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: branch.id,
      userId: user.userId,
      action: 'CREATE_BRANCH',
      module: 'branches',
      entityType: 'Branch',
      entityId: branch.id,
      description: 'Sucursal creada',
    });
    return branch;
  }

  async update(user: AuthUser, id: string, dto: UpdateBranchDto) {
    const existing = await this.prisma.branch.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Branch not found');
    if (
      existing.isMain &&
      (dto.isMain === false || dto.status === 'INACTIVE')
    ) {
      throw new BadRequestException(
        'Assign another main branch before disabling the current one',
      );
    }
    const branch = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await tx.branch.updateMany({
          where: { companyId: user.companyId, isMain: true, id: { not: id } },
          data: { isMain: false },
        });
      }
      return tx.branch.update({
        where: { id },
        data: {
          ...dto,
          name: dto.name?.trim(),
          code: dto.code?.toUpperCase(),
        },
      });
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: branch.id,
      userId: user.userId,
      action: 'UPDATE_BRANCH',
      module: 'branches',
      entityType: 'Branch',
      entityId: branch.id,
      description: 'Sucursal actualizada',
    });
    return branch;
  }
}
