import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

const userSelect = {
  id: true,
  companyId: true,
  branchId: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, code: true, name: true } },
  branch: { select: { id: true, code: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: AuthUser) {
    return this.prisma.user.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: userSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const found = await this.prisma.user.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: userSelect,
    });
    if (!found) throw new NotFoundException('User not found');
    return found;
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    const role = await this.validateRelations(
      user.companyId,
      dto.roleId,
      dto.branchId,
    );
    this.assertCanAssignRole(user, role.code);
    try {
      const passwordHash = await hash(
        dto.password,
        Number(this.config.get<string>('BCRYPT_ROUNDS', '12')),
      );
      const created = await this.prisma.$transaction(async (tx) => {
        const nextUser = await tx.user.create({
          data: {
            companyId: user.companyId,
            branchId: dto.branchId,
            roleId: dto.roleId,
            name: dto.name.trim(),
            email: dto.email.toLowerCase().trim(),
            phone: dto.phone?.trim(),
            passwordHash,
          },
          select: userSelect,
        });
        if (dto.branchId) {
          await tx.userBranchMembership.create({
            data: {
              companyId: user.companyId,
              userId: nextUser.id,
              branchId: dto.branchId,
              isDefault: true,
            },
          });
        }
        return nextUser;
      });
      await this.audit.create({
        companyId: user.companyId,
        branchId: created.branchId,
        userId: user.userId,
        action: 'CREATE_USER',
        module: 'users',
        entityType: 'User',
        entityId: created.id,
        description: 'Usuario interno creado',
      });
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateUserDto) {
    const current = await this.findOne(user, id);
    this.assertCanManageUser(user, current.role.code);
    if (dto.roleId || dto.branchId) {
      const role = await this.validateRelations(
        user.companyId,
        dto.roleId ?? current.role.id,
        dto.branchId ?? current.branchId ?? undefined,
      );
      this.assertCanAssignRole(user, role.code);
      if (id === user.userId && dto.roleId && role.code !== user.roleCode) {
        throw new BadRequestException('You cannot change your own role');
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          phone: dto.phone?.trim(),
          roleId: dto.roleId,
          branchId: dto.branchId,
        },
        select: userSelect,
      });
      if (dto.branchId) {
        await tx.userBranchMembership.updateMany({
          where: { companyId: user.companyId, userId: id },
          data: { isDefault: false },
        });
        await tx.userBranchMembership.upsert({
          where: { userId_branchId: { userId: id, branchId: dto.branchId } },
          update: { isDefault: true },
          create: {
            companyId: user.companyId,
            userId: id,
            branchId: dto.branchId,
            isDefault: true,
          },
        });
      }
      return nextUser;
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: updated.branchId,
      userId: user.userId,
      action: dto.roleId ? 'ASSIGN_ROLE' : 'UPDATE_USER',
      module: 'users',
      entityType: 'User',
      entityId: updated.id,
      description: dto.roleId
        ? 'Rol de usuario actualizado'
        : 'Usuario actualizado',
    });
    return updated;
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateUserStatusDto) {
    if (id === user.userId && dto.status !== 'ACTIVE') {
      throw new BadRequestException('You cannot disable your own user');
    }
    const current = await this.findOne(user, id);
    this.assertCanManageUser(user, current.role.code);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: userSelect,
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: updated.branchId,
      userId: user.userId,
      action: 'UPDATE_USER_STATUS',
      module: 'users',
      entityType: 'User',
      entityId: updated.id,
      description: `Estado de usuario actualizado a ${dto.status}`,
    });
    return updated;
  }

  private async validateRelations(
    companyId: string,
    roleId: string,
    branchId?: string,
  ) {
    const [role, branch] = await Promise.all([
      this.prisma.role.findFirst({
        where: { id: roleId, companyId, isActive: true },
      }),
      branchId
        ? this.prisma.branch.findFirst({
            where: { id: branchId, companyId, deletedAt: null },
          })
        : Promise.resolve(true),
    ]);
    if (!role) throw new BadRequestException('Role does not belong to company');
    if (!branch)
      throw new BadRequestException('Branch does not belong to company');
    return role;
  }

  private assertCanAssignRole(user: AuthUser, roleCode: UserRole) {
    if (roleCode === UserRole.OWNER && user.roleCode !== UserRole.OWNER) {
      throw new ForbiddenException('Only an owner can assign the owner role');
    }
  }

  private assertCanManageUser(user: AuthUser, targetRoleCode: UserRole) {
    if (targetRoleCode === UserRole.OWNER && user.roleCode !== UserRole.OWNER) {
      throw new ForbiddenException('Only an owner can manage another owner');
    }
  }
}
