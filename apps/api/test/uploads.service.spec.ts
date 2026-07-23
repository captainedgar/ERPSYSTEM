import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

import type { AuditService } from '../src/audit/audit.service';
import {
  PRODUCT_IMAGE_MAX_BYTES,
  UploadsService,
} from '../src/uploads/uploads.service';

describe('UploadsService', () => {
  const audit = { create: jest.fn() } as unknown as AuditService;
  const service = new UploadsService(audit);
  const user = {
    companyId: 'company-1',
    userId: 'user-1',
    branchId: null,
  } as never;

  it('rejects non-image product uploads', async () => {
    await expect(
      service.productImage(user, {
        buffer: Buffer.from('%PDF'),
        mimetype: 'application/pdf',
        originalname: 'manual.pdf',
        size: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects product images above 3 MB', async () => {
    await expect(
      service.productImage(user, {
        buffer: Buffer.alloc(1),
        mimetype: 'image/png',
        originalname: 'large.png',
        size: PRODUCT_IMAGE_MAX_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rejects files whose declared image type does not match their signature', async () => {
    await expect(
      service.productImage(user, {
        buffer: Buffer.from('not-a-png'),
        mimetype: 'image/png',
        originalname: 'fake.png',
        size: 9,
      }),
    ).rejects.toThrow('El archivo no es una imagen valida');
  });
});
