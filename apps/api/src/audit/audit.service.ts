import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { RequestContext } from '../common/interfaces/auth-user.interface';

export interface AuditEvent extends RequestContext {
  companyId: string;
  branchId?: string | null;
  userId?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  create(event: AuditEvent) {
    return this.createWithClient(this.prisma, event);
  }

  createWithClient(
    client: Prisma.TransactionClient | PrismaService,
    event: AuditEvent,
  ) {
    return client.auditLog.create({
      data: {
        companyId: event.companyId,
        branchId: event.branchId,
        userId: event.userId,
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
