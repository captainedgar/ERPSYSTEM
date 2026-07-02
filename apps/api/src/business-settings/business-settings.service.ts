import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';

@Injectable()
export class BusinessSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findMine(user: AuthUser) {
    return this.prisma.businessSettings.findUniqueOrThrow({
      where: { companyId: user.companyId },
    });
  }

  async updateMine(user: AuthUser, dto: UpdateBusinessSettingsDto) {
    const settings = await this.prisma.businessSettings.update({
      where: { companyId: user.companyId },
      data: {
        ...dto,
        currency: dto.currency?.toUpperCase(),
      },
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'UPDATE_BUSINESS_SETTINGS',
      module: 'settings',
      entityType: 'BusinessSettings',
      entityId: settings.id,
      description: 'Configuración del negocio actualizada',
    });
    return settings;
  }
}
