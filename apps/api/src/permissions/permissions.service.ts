import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PERMISSIONS } from './permission-definitions';

@Injectable()
export class PermissionsService {
  async ensureBasePermissions(tx: Prisma.TransactionClient) {
    return Promise.all(
      PERMISSIONS.map(([code, module, action]) =>
        tx.permission.upsert({
          where: { code },
          update: { module, action },
          create: { code, module, action },
        }),
      ),
    );
  }
}
