import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformBillingService } from './platform-billing.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    PlatformAuthController,
    PlatformAdminController,
    PlatformBillingController,
  ],
  providers: [
    PlatformAuthGuard,
    PlatformAuthService,
    PlatformAdminService,
    PlatformAuditService,
    PlatformBillingService,
  ],
})
export class PlatformAdminModule {}
