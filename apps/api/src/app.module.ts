import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { BranchesModule } from './branches/branches.module';
import { BusinessSettingsModule } from './business-settings/business-settings.module';
import { CashModule } from './cash/cash.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthGuard } from './common/guards/auth.guard';
import { CompanySuspensionGuard } from './common/guards/company-suspension.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CompaniesModule } from './companies/companies.module';
import { CustomersModule } from './customers/customers.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { HealthController } from './health.controller';
import { PermissionsModule } from './permissions/permissions.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PosModule } from './pos/pos.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductImportModule } from './product-import/product-import.module';
import { InventoryModule } from './inventory/inventory.module';
import { InternalDocumentsModule } from './internal-documents/internal-documents.module';
import { ProductsModule } from './products/products.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SalesModule } from './sales/sales.module';
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
    PlatformAdminModule,
    CashModule,
    PosModule,
    RolesModule,
    SalesModule,
    InternalDocumentsModule,
    FiscalModule,
    AuthModule,
    InventoryModule,
    CompaniesModule,
    CustomersModule,
    BranchesModule,
    UsersModule,
    BusinessSettingsModule,
    CategoriesModule,
    BrandsModule,
    UnitsModule,
    ProductsModule,
    ProductImportModule,
    ServicesModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CompanySuspensionGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
