import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { BranchesModule } from './branches/branches.module';
import { BusinessSettingsModule } from './business-settings/business-settings.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CompaniesModule } from './companies/companies.module';
import { HealthController } from './health.controller';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductsModule } from './products/products.module';
import { RolesModule } from './roles/roles.module';
import { ServicesModule } from './services/services.module';
import { SessionsModule } from './sessions/sessions.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      isGlobal: true,
    }),
    PrismaModule,
    AuditModule,
    SessionsModule,
    PermissionsModule,
    RolesModule,
    AuthModule,
    InventoryModule,
    CompaniesModule,
    BranchesModule,
    UsersModule,
    BusinessSettingsModule,
    CategoriesModule,
    BrandsModule,
    UnitsModule,
    ProductsModule,
    ServicesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
