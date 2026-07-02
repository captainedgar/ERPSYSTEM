import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  BUSINESS_TEMPLATES,
  listBusinessTemplates,
} from './business-templates';
import { ApplyBusinessTemplateDto } from './dto/apply-business-template.dto';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';

@Injectable()
export class BusinessSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findMine(user: AuthUser) {
    const settings = await this.prisma.businessSettings.findUniqueOrThrow({
      where: { companyId: user.companyId },
      include: { company: { select: { businessType: true } } },
    });
    return this.toResponse(settings);
  }

  findTemplates() {
    return listBusinessTemplates();
  }

  async updateMine(user: AuthUser, dto: UpdateBusinessSettingsDto) {
    if (dto.defaultPaymentMethod || dto.enabledPaymentMethods) {
      const current = await this.prisma.businessSettings.findUniqueOrThrow({
        where: { companyId: user.companyId },
        select: {
          defaultPaymentMethod: true,
          enabledPaymentMethods: true,
        },
      });
      const defaultPaymentMethod =
        dto.defaultPaymentMethod ?? current.defaultPaymentMethod;
      const enabledPaymentMethods =
        dto.enabledPaymentMethods ?? current.enabledPaymentMethods;
      if (!enabledPaymentMethods.includes(defaultPaymentMethod)) {
        throw new BadRequestException('Default payment method must be enabled');
      }
    }
    const { businessType, ...settingsData } = dto;
    await this.prisma.$transaction(async (tx) => {
      if (businessType) {
        await tx.company.update({
          where: { id: user.companyId },
          data: { businessType },
        });
      }
      await tx.businessSettings.update({
        where: { companyId: user.companyId },
        data: {
          ...settingsData,
          receiptFooterText: dto.receiptFooterText?.trim(),
        },
      });
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'BUSINESS_SETTINGS_UPDATED',
      module: 'settings',
      entityType: 'BusinessSettings',
      description: 'Configuración del negocio actualizada',
      metadata: { fields: Object.keys(dto) },
    });
    return this.findMine(user);
  }

  async applyTemplate(user: AuthUser, dto: ApplyBusinessTemplateDto) {
    const template = BUSINESS_TEMPLATES[dto.businessType];
    await this.prisma.$transaction([
      this.prisma.company.update({
        where: { id: user.companyId },
        data: { businessType: dto.businessType },
      }),
      this.prisma.businessSettings.update({
        where: { companyId: user.companyId },
        data: template.settings,
      }),
    ]);
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'BUSINESS_TEMPLATE_APPLIED',
      module: 'settings',
      entityType: 'BusinessSettings',
      description: `Plantilla ${template.name} aplicada`,
      metadata: { businessType: dto.businessType },
    });
    return this.findMine(user);
  }

  async completeOnboarding(user: AuthUser) {
    const current = await this.prisma.businessSettings.findUniqueOrThrow({
      where: { companyId: user.companyId },
    });
    if (!current.onboardingCompleted) {
      await this.prisma.businessSettings.update({
        where: { companyId: user.companyId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
        },
      });
      await this.audit.create({
        companyId: user.companyId,
        branchId: user.branchId,
        userId: user.userId,
        action: 'ONBOARDING_COMPLETED',
        module: 'settings',
        entityType: 'BusinessSettings',
        entityId: current.id,
        description: 'Configuración inicial completada',
      });
    }
    return this.findMine(user);
  }

  private toResponse<
    T extends {
      company: { businessType: string };
    },
  >(settings: T) {
    const { company, ...data } = settings;
    return { ...data, businessType: company.businessType };
  }
}
