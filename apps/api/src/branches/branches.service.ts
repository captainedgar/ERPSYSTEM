import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchStatus, Prisma, UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignBranchUsersDto,
  UpdateUserBranchesDto,
} from './dto/assign-branch-users.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

const branchInclude = {
  _count: { select: { userMemberships: true, users: true } },
} satisfies Prisma.BranchInclude;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser) {
    return this.prisma.branch.findMany({
      where: this.visibleBranchWhere(user),
      include: branchInclude,
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });
  }

  async available(user: AuthUser) {
    const branches = await this.prisma.branch.findMany({
      where: {
        ...this.visibleBranchWhere(user),
        status: BranchStatus.ACTIVE,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isMain: true,
        status: true,
        city: true,
        province: true,
        userMemberships: {
          where: { userId: user.userId },
          select: { isDefault: true },
        },
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    });
    const defaultBranch =
      branches.find((branch) =>
        branch.userMemberships.some((membership) => membership.isDefault),
      ) ??
      branches.find((branch) => branch.id === user.branchId) ??
      branches.find((branch) => branch.isMain) ??
      branches[0] ??
      null;
    return {
      items: branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        isMain: branch.isMain,
        status: branch.status,
        city: branch.city,
        province: branch.province,
      })),
      defaultBranchId: defaultBranch?.id ?? null,
      activeBranchId: user.branchId,
    };
  }

  async findOne(user: AuthUser, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, ...this.visibleBranchWhere(user) },
      include: branchInclude,
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(user: AuthUser, dto: CreateBranchDto) {
    const branch = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await tx.branch.updateMany({
          where: { companyId: user.companyId, isMain: true },
          data: { isMain: false },
        });
      }
      const created = await tx.branch.create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          code: dto.code.toUpperCase(),
          phone: this.optional(dto.phone),
          email: dto.email?.toLowerCase().trim(),
          address: this.optional(dto.address),
          city: this.optional(dto.city),
          province: this.optional(dto.province),
          isMain: dto.isMain ?? false,
        },
      });
      if (!created.isMain) {
        await this.ensureCompanyHasMainBranch(tx, user.companyId);
      }
      return created;
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
    const existing = await this.findOwnedBranch(user.companyId, id);
    if (existing.isMain && dto.isMain === false) {
      throw new BadRequestException(
        'Marca otra sucursal como principal antes de desmarcar esta',
      );
    }
    const branch = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        await this.markMain(tx, user.companyId, id);
      }
      return tx.branch.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code?.toUpperCase(),
          phone: dto.phone === undefined ? undefined : this.optional(dto.phone),
          email:
            dto.email === undefined
              ? undefined
              : dto.email?.toLowerCase().trim(),
          address:
            dto.address === undefined ? undefined : this.optional(dto.address),
          city: dto.city === undefined ? undefined : this.optional(dto.city),
          province:
            dto.province === undefined
              ? undefined
              : this.optional(dto.province),
          isMain: dto.isMain ? true : undefined,
          status: dto.status,
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

  async updateStatus(user: AuthUser, id: string, active: boolean) {
    const existing = await this.findOwnedBranch(user.companyId, id);
    if (!active) await this.assertCanDeactivate(user.companyId, existing);
    const branch = await this.prisma.branch.update({
      where: { id },
      data: { status: active ? BranchStatus.ACTIVE : BranchStatus.INACTIVE },
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: branch.id,
      userId: user.userId,
      action: active ? 'ACTIVATE_BRANCH' : 'DEACTIVATE_BRANCH',
      module: 'branches',
      entityType: 'Branch',
      entityId: branch.id,
      description: active ? 'Sucursal activada' : 'Sucursal desactivada',
    });
    return branch;
  }

  async setMain(user: AuthUser, id: string) {
    const existing = await this.findOwnedBranch(user.companyId, id);
    if (existing.status !== BranchStatus.ACTIVE) {
      throw new BadRequestException(
        'Solo una sucursal activa puede ser principal',
      );
    }
    const branch = await this.prisma.$transaction((tx) =>
      this.markMain(tx, user.companyId, id),
    );
    await this.audit.create({
      companyId: user.companyId,
      branchId: branch.id,
      userId: user.userId,
      action: 'SET_MAIN_BRANCH',
      module: 'branches',
      entityType: 'Branch',
      entityId: branch.id,
      description: 'Sucursal marcada como principal',
    });
    return branch;
  }

  async users(user: AuthUser, branchId: string) {
    await this.findOwnedBranch(user.companyId, branchId);
    return this.prisma.userBranchMembership.findMany({
      where: { companyId: user.companyId, branchId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { user: { name: 'asc' } }],
    });
  }

  async assignUsers(
    user: AuthUser,
    branchId: string,
    dto: AssignBranchUsersDto,
  ) {
    await this.findOwnedBranch(user.companyId, branchId);
    await this.assertUsersBelongToCompany(user.companyId, dto.userIds);
    await this.prisma.$transaction(async (tx) => {
      await tx.userBranchMembership.createMany({
        data: dto.userIds.map((userId) => ({
          companyId: user.companyId,
          branchId,
          userId,
          isDefault: dto.defaultUserId === userId,
        })),
        skipDuplicates: true,
      });
      if (dto.defaultUserId) {
        await this.setDefaultBranch(
          tx,
          user.companyId,
          dto.defaultUserId,
          branchId,
        );
      }
    });
    return this.users(user, branchId);
  }

  async removeUser(user: AuthUser, branchId: string, userId: string) {
    await this.findOwnedBranch(user.companyId, branchId);
    const memberships = await this.prisma.userBranchMembership.count({
      where: { companyId: user.companyId, userId },
    });
    if (memberships <= 1) {
      throw new BadRequestException(
        'El usuario debe conservar al menos una sucursal asignada',
      );
    }
    await this.prisma.userBranchMembership.deleteMany({
      where: { companyId: user.companyId, branchId, userId },
    });
    return { success: true };
  }

  async userBranches(user: AuthUser, targetUserId: string) {
    await this.assertUsersBelongToCompany(user.companyId, [targetUserId]);
    return this.prisma.userBranchMembership.findMany({
      where: { companyId: user.companyId, userId: targetUserId },
      include: { branch: true },
      orderBy: [{ isDefault: 'desc' }, { branch: { name: 'asc' } }],
    });
  }

  async updateUserBranches(
    user: AuthUser,
    targetUserId: string,
    dto: UpdateUserBranchesDto,
  ) {
    if (!dto.branchIds.length) {
      throw new BadRequestException('Selecciona al menos una sucursal');
    }
    await this.assertUsersBelongToCompany(user.companyId, [targetUserId]);
    await this.assertBranchesBelongToCompany(user.companyId, dto.branchIds);
    const defaultBranchId = dto.defaultBranchId ?? dto.branchIds[0]!;
    if (!dto.branchIds.includes(defaultBranchId)) {
      throw new BadRequestException(
        'La sucursal por defecto debe estar asignada al usuario',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userBranchMembership.deleteMany({
        where: { companyId: user.companyId, userId: targetUserId },
      });
      await tx.userBranchMembership.createMany({
        data: dto.branchIds.map((branchId) => ({
          companyId: user.companyId,
          userId: targetUserId,
          branchId,
          isDefault: branchId === defaultBranchId,
        })),
      });
      await tx.user.update({
        where: { id: targetUserId },
        data: { branchId: defaultBranchId },
      });
    });
    return this.userBranches(user, targetUserId);
  }

  private visibleBranchWhere(user: AuthUser): Prisma.BranchWhereInput {
    const base: Prisma.BranchWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (user.roleCode === UserRole.OWNER || user.roleCode === UserRole.ADMIN) {
      return base;
    }
    return {
      ...base,
      OR: [
        { users: { some: { id: user.userId } } },
        { userMemberships: { some: { userId: user.userId } } },
      ],
    };
  }

  private async findOwnedBranch(companyId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  private async assertCanDeactivate(
    companyId: string,
    branch: { id: string; isMain: boolean },
  ) {
    if (branch.isMain) {
      throw new BadRequestException(
        'Marca otra sucursal principal antes de desactivar esta',
      );
    }
    const activeCount = await this.prisma.branch.count({
      where: {
        companyId,
        status: BranchStatus.ACTIVE,
        deletedAt: null,
        id: { not: branch.id },
      },
    });
    if (activeCount < 1) {
      throw new BadRequestException(
        'No puedes desactivar la unica sucursal activa',
      );
    }
  }

  private async ensureCompanyHasMainBranch(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    const main = await tx.branch.findFirst({
      where: {
        companyId,
        isMain: true,
        status: BranchStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (main) return;
    const first = await tx.branch.findFirst({
      where: { companyId, status: BranchStatus.ACTIVE, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!first) return;
    await tx.branch.update({ where: { id: first.id }, data: { isMain: true } });
  }

  private async markMain(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ) {
    await tx.branch.updateMany({
      where: { companyId, isMain: true, id: { not: id } },
      data: { isMain: false },
    });
    return tx.branch.update({
      where: { id },
      data: { isMain: true, status: BranchStatus.ACTIVE },
    });
  }

  private async setDefaultBranch(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    branchId: string,
  ) {
    await tx.userBranchMembership.updateMany({
      where: { companyId, userId },
      data: { isDefault: false },
    });
    await tx.userBranchMembership.upsert({
      where: { userId_branchId: { userId, branchId } },
      update: { isDefault: true },
      create: { companyId, userId, branchId, isDefault: true },
    });
    await tx.user.update({ where: { id: userId }, data: { branchId } });
  }

  private async assertUsersBelongToCompany(
    companyId: string,
    userIds: string[],
  ) {
    const count = await this.prisma.user.count({
      where: { id: { in: userIds }, companyId, deletedAt: null },
    });
    if (count !== new Set(userIds).size) {
      throw new BadRequestException(
        'Uno o mas usuarios no pertenecen a la empresa',
      );
    }
  }

  private async assertBranchesBelongToCompany(
    companyId: string,
    branchIds: string[],
  ) {
    const count = await this.prisma.branch.count({
      where: {
        id: { in: branchIds },
        companyId,
        deletedAt: null,
        status: BranchStatus.ACTIVE,
      },
    });
    if (count !== new Set(branchIds).size) {
      throw new BadRequestException(
        'Una o mas sucursales no estan disponibles',
      );
    }
  }

  private optional(value: string | undefined) {
    return value?.trim() || undefined;
  }
}
