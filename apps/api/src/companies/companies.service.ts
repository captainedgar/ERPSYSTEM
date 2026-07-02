import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findMine(user: AuthUser) {
    return this.prisma.company.findFirstOrThrow({
      where: { id: user.companyId, deletedAt: null },
      include: { settings: true },
    });
  }

  async updateMine(user: AuthUser, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        ...dto,
        name: dto.name?.trim(),
        email: dto.email?.toLowerCase().trim(),
      },
    });
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'UPDATE_COMPANY',
      module: 'companies',
      entityType: 'Company',
      entityId: company.id,
      description: 'Datos de empresa actualizados',
    });
    return company;
  }
}
