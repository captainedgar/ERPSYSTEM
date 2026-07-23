import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { getCompanyLogoUploadRoot } from '../common/upload-paths';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedCompanyLogo } from './companies.controller';
import { UpdateCompanyDto } from './dto/update-company.dto';

export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;

const allowedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const extensionsByMimeType: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

const allowedExtensions = new Set([
  ...Object.values(extensionsByMimeType),
  '.jpeg',
]);

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

  async findMyLogo(user: AuthUser) {
    const company = await this.prisma.company.findFirstOrThrow({
      where: { id: user.companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        legalName: true,
        logoUrl: true,
        logoFileKey: true,
        logoUpdatedAt: true,
      },
    });
    return {
      companyId: company.id,
      name: company.name,
      legalName: company.legalName,
      logoUrl: company.logoUrl,
      logoFileKey: company.logoFileKey,
      logoUpdatedAt: company.logoUpdatedAt,
    };
  }

  async uploadMyLogo(user: AuthUser, file?: UploadedCompanyLogo) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debes seleccionar un archivo de logo');
    }
    if (file.size > COMPANY_LOGO_MAX_BYTES) {
      throw new PayloadTooLargeException('El logo no puede superar 2MB');
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Solo se permiten PNG, JPG o WEBP');
    }
    const originalExtension = extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(originalExtension)) {
      throw new BadRequestException('La extension del logo no es permitida');
    }
    if (!this.hasValidImageSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('El archivo no es una imagen valida');
    }

    const company = await this.prisma.company.findFirstOrThrow({
      where: { id: user.companyId, deletedAt: null },
      select: { id: true, logoFileKey: true },
    });
    const extension = extensionsByMimeType[file.mimetype];
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const fileKey = `${company.id}/${fileName}`;
    const relativePath = normalize(fileKey);
    if (relativePath.startsWith('..') || relativePath.includes('..')) {
      throw new BadRequestException('Ruta de logo invalida');
    }

    const uploadRoot = this.logoUploadRoot();
    const companyDir = join(uploadRoot, company.id);
    const targetPath = join(uploadRoot, relativePath);
    await mkdir(companyDir, { recursive: true });
    await writeFile(targetPath, file.buffer, { flag: 'wx' });

    const previousFileKey = company.logoFileKey;
    const logoUrl = `/uploads/company-logos/${fileKey}`;
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        logoUrl,
        logoFileKey: fileKey,
        logoUpdatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        legalName: true,
        logoUrl: true,
        logoFileKey: true,
        logoUpdatedAt: true,
      },
    });
    await this.removeStoredLogo(previousFileKey);
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: previousFileKey
        ? 'COMPANY_LOGO_UPDATED'
        : 'COMPANY_LOGO_UPLOADED',
      module: 'companies',
      entityType: 'Company',
      entityId: company.id,
      description: previousFileKey
        ? 'Logo de empresa actualizado'
        : 'Logo de empresa cargado',
      metadata: { logoFileKey: fileKey, mimeType: file.mimetype },
    });
    return {
      companyId: updated.id,
      name: updated.name,
      legalName: updated.legalName,
      logoUrl: updated.logoUrl,
      logoFileKey: updated.logoFileKey,
      logoUpdatedAt: updated.logoUpdatedAt,
    };
  }

  async deleteMyLogo(user: AuthUser) {
    const company = await this.prisma.company.findFirstOrThrow({
      where: { id: user.companyId, deletedAt: null },
      select: { id: true, name: true, legalName: true, logoFileKey: true },
    });
    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        logoUrl: null,
        logoFileKey: null,
        logoUpdatedAt: new Date(),
      },
    });
    await this.removeStoredLogo(company.logoFileKey);
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'COMPANY_LOGO_DELETED',
      module: 'companies',
      entityType: 'Company',
      entityId: company.id,
      description: 'Logo de empresa eliminado',
    });
    return {
      companyId: company.id,
      name: company.name,
      legalName: company.legalName,
      logoUrl: null,
      logoFileKey: null,
      logoUpdatedAt: null,
    };
  }

  private logoUploadRoot() {
    return getCompanyLogoUploadRoot();
  }

  private async removeStoredLogo(fileKey?: string | null) {
    if (!fileKey) return;
    const normalized = normalize(fileKey);
    if (normalized.startsWith('..') || normalized.includes('..')) return;
    await unlink(join(this.logoUploadRoot(), normalized)).catch(
      () => undefined,
    );
  }

  private hasValidImageSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/png')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg')
      return (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[buffer.length - 2] === 0xff &&
        buffer[buffer.length - 1] === 0xd9
      );
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
}
