import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompanySubscriptionStatus,
  Currency,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { compare, hash } from 'bcrypt';

import { AuditService } from '../audit/audit.service';
import { DEFAULT_UNITS } from '../catalog/default-units';
import type {
  AuthUser,
  RequestContext,
} from '../common/interfaces/auth-user.interface';
import { PERMISSIONS } from '../permissions/permission-definitions';
import { PrismaService } from '../prisma/prisma.service';
import { permissionCodesForRole, RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  planModules,
  STANDARD_SAAS_PLANS,
  type SaasPlanCode,
} from '../company-entitlements/saas-plan-entitlements';
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
  role: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
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
        const planDefinition =
          STANDARD_SAAS_PLANS[dto.planCode ?? ('BASIC' satisfies SaasPlanCode)];
        const plan = await tx.saasPlan.upsert({
          where: { name: planDefinition.name },
          update: {},
          create: {
            name: planDefinition.name,
            description: planDefinition.description,
            price: planDefinition.price,
            currency: Currency.DOP,
            billingInterval: planDefinition.billingInterval,
            graceDays: planDefinition.graceDays,
            maxUsers: planDefinition.maxUsers,
            maxBranches: planDefinition.maxBranches,
            modules: planModules(planDefinition),
          },
        });
        if (!plan.isActive) {
          throw new BadRequestException('El plan seleccionado no esta activo.');
        }
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
        await tx.userBranchMembership.create({
          data: {
            companyId: company.id,
            userId: user.id,
            branchId: branch.id,
            isDefault: true,
          },
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
        const startsAt = new Date();
        const trialEndsAt = new Date(startsAt);
        trialEndsAt.setUTCDate(
          trialEndsAt.getUTCDate() + planDefinition.trialDays,
        );
        await tx.companySubscription.create({
          data: {
            companyId: company.id,
            planId: plan.id,
            status:
              planDefinition.trialDays > 0
                ? CompanySubscriptionStatus.TRIAL
                : CompanySubscriptionStatus.PAYMENT_DUE,
            startsAt,
            currentPeriodStart: startsAt,
            currentPeriodEnd: trialEndsAt,
            nextPaymentDueAt: trialEndsAt,
            graceDays: plan.graceDays,
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

  async registrationPlans() {
    const stored = await this.prisma.saasPlan.findMany({
      where: {
        name: {
          in: Object.values(STANDARD_SAAS_PLANS).map(({ name }) => name),
        },
      },
    });
    const byName = new Map(stored.map((plan) => [plan.name, plan]));
    return Object.values(STANDARD_SAAS_PLANS)
      .filter((plan) => byName.get(plan.name)?.isActive !== false)
      .map((plan) => {
        const configured = byName.get(plan.name);
        return {
          code: plan.code,
          name: configured?.name ?? plan.name,
          description: configured?.description ?? plan.description,
          price: Number(configured?.price ?? plan.price),
          billingInterval: configured?.billingInterval ?? plan.billingInterval,
          trialDays: plan.trialDays,
          maxUsers: configured?.maxUsers ?? plan.maxUsers,
          maxBranches: configured?.maxBranches ?? plan.maxBranches,
          maxProducts: plan.maxProducts,
          features: plan.features,
          customLimits: plan.customLimits ?? false,
        };
      });
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

  private async findPublicUser(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: {
        id: userId,
        companyId,
        deletedAt: null,
        role: { companyId },
      },
      select: publicUserSelect,
    });

    const { role, ...publicUser } = user;
    return {
      ...publicUser,
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
      },
      permissions: permissionCodesForRole(
        role.code,
        PERMISSIONS.map(([code]) => code),
      ),
    };
  }

  private hashPassword(password: string) {
    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS', '12'));
    return hash(password, rounds);
  }
}
