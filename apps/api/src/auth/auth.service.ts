import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcrypt';

import { AuditService } from '../audit/audit.service';
import { DEFAULT_UNITS } from '../catalog/default-units';
import type {
  AuthUser,
  RequestContext,
} from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

const publicUserSelect = {
  id: true,
  companyId: true,
  branchId: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  company: {
    select: {
      id: true,
      name: true,
      legalName: true,
      businessType: true,
      status: true,
      logoUrl: true,
      logoUpdatedAt: true,
    },
  },
  lastLoginAt: true,
  role: { select: { id: true, code: true, name: true } },
  branch: { select: { id: true, name: true, code: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rolesService: RolesService,
    private readonly sessionsService: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async registerCompany(dto: RegisterCompanyDto, context: RequestContext) {
    const passwordHash = await this.hashPassword(dto.password);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: dto.companyName.trim(),
            legalName: dto.legalName?.trim(),
            rncOrCedula: dto.rncOrCedula?.trim(),
            phone: dto.companyPhone?.trim(),
            email: dto.companyEmail?.toLowerCase().trim(),
            address: dto.address?.trim(),
            businessType: dto.businessType,
          },
        });
        const branch = await tx.branch.create({
          data: {
            companyId: company.id,
            name: 'Sucursal principal',
            code: 'MAIN',
            address: dto.address?.trim(),
            phone: dto.companyPhone?.trim(),
            isMain: true,
          },
        });
        await tx.businessSettings.create({ data: { companyId: company.id } });
        await tx.unit.createMany({
          data: DEFAULT_UNITS.map((unit) => ({
            companyId: company.id,
            ...unit,
          })),
        });
        const ownerRole = await this.rolesService.initializeCompanyRoles(
          tx,
          company.id,
        );
        const user = await tx.user.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            roleId: ownerRole.id,
            name: dto.ownerName.trim(),
            email: dto.ownerEmail.toLowerCase().trim(),
            passwordHash,
          },
          include: { role: true },
        });
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            userId: user.id,
            action: 'REGISTER_COMPANY',
            module: 'auth',
            entityType: 'Company',
            entityId: company.id,
            description: 'Empresa y usuario propietario registrados',
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
        return { company, branch, user };
      });

      const tokens = await this.sessionsService.create(result.user, context);
      const user = await this.findPublicUser(result.user.id, result.company.id);
      return {
        company: result.company,
        branch: result.branch,
        user,
        ...tokens,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or tax identifier already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, context: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { role: true },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.sessionsService.create(user, context);
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      description: 'Inicio de sesión exitoso',
      ...context,
    });
    return {
      user: await this.findPublicUser(user.id, user.companyId),
      ...tokens,
    };
  }

  async refresh(refreshToken: string, context: RequestContext) {
    const result = await this.sessionsService.rotate(refreshToken);
    await this.audit.create({
      companyId: result.user.companyId,
      branchId: result.user.branchId,
      userId: result.user.id,
      action: 'REFRESH_TOKEN',
      module: 'auth',
      description: 'Sesión renovada',
      ...context,
    });
    return result.tokens;
  }

  async logout(user: AuthUser, context: RequestContext) {
    await this.sessionsService.revoke(user.sessionId, user.userId);
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'LOGOUT',
      module: 'auth',
      description: 'Sesión cerrada',
      ...context,
    });
    return { success: true };
  }

  me(user: AuthUser) {
    return this.findPublicUser(user.userId, user.companyId);
  }

  private findPublicUser(userId: string, companyId: string) {
    return this.prisma.user.findFirstOrThrow({
      where: { id: userId, companyId, deletedAt: null },
      select: publicUserSelect,
    });
  }

  private hashPassword(password: string) {
    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS', '12'));
    return hash(password, rounds);
  }
}
