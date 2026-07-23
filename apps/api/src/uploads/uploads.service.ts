import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { getCompanyProductUploadRoot } from '../common/upload-paths';
import type { UploadedProductImage } from './uploads.controller';

export const PRODUCT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

const extensionsByMimeType: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

@Injectable()
export class UploadsService {
  constructor(private readonly audit: AuditService) {}

  async productImage(user: AuthUser, file?: UploadedProductImage) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Debes seleccionar una imagen');
    if (file.size > PRODUCT_IMAGE_MAX_BYTES)
      throw new PayloadTooLargeException('La imagen no puede superar 3MB');
    const extension = extensionsByMimeType[file.mimetype];
    if (!extension)
      throw new BadRequestException('Solo se permiten PNG, JPG o WEBP');
    const originalExtension = extname(file.originalname).toLowerCase();
    if (
      ![extension, extension === '.jpg' ? '.jpeg' : extension].includes(
        originalExtension,
      ) ||
      !this.hasValidSignature(file.buffer, file.mimetype)
    )
      throw new BadRequestException('El archivo no es una imagen valida');

    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const companyId = normalize(user.companyId);
    if (
      companyId.includes('..') ||
      companyId.includes('/') ||
      companyId.includes('\\')
    )
      throw new BadRequestException('Empresa invalida');
    const directory = join(
      getCompanyProductUploadRoot(),
      companyId,
      'products',
    );
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, fileName), file.buffer, { flag: 'wx' });
    const imageUrl = `/uploads/companies/${companyId}/products/${fileName}`;
    await this.audit.create({
      companyId: user.companyId,
      branchId: user.branchId,
      userId: user.userId,
      action: 'PRODUCT_IMAGE_UPLOADED',
      module: 'products',
      entityType: 'ProductMedia',
      description: 'Imagen de producto cargada',
      metadata: { imageUrl, mimeType: file.mimetype, size: file.size },
    });
    return { imageUrl };
  }

  private hasValidSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/png')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === 'image/jpeg')
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
