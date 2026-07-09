import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';

export interface PlatformAuditEvent extends PlatformRequestContext {
  user?: PlatformAuthUser | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  create(event: PlatformAuditEvent) {
    return this.prisma.platformAuditLog.create({
      data: {
        platformUserId: event.user?.platformUserId,
        action: event.action,
        module: event.module,
        entityType: event.entityType,
        entityId: event.entityId,
        description: event.description,
        metadataJson: event.metadata,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
    });
  }
}
