import {
  BusinessType,
  CashMovementType,
  CashSessionStatus,
  CatalogStatus,
  CategoryType,
  CustomerDocumentType,
  CustomerStatus,
  CustomerType,
  ElectronicDocumentType,
  ElectronicInvoiceStatus,
  FiscalEnvironment,
  FiscalProviderMode,
  FiscalProviderStatus,
  InternalDocumentStatus,
  InternalDocumentType,
  InventoryMovementType,
  InventoryTransferStatus,
  PaymentMethod,
  PermissionAction,
  PlatformRole,
  PlatformUserStatus,
  PrismaClient,
  ProductAlternativeCodeType,
  ProductCompatibilityGroupStatus,
  ProductSubstituteType,
  SaleItemType,
  SaleStatus,
  SaasBillingInterval,
  CompanySubscriptionStatus,
  Currency,
  TaxpayerType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { hash } from 'bcrypt';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEMO = 'comercia-demo-repuestos';
const COMPANY_ID = `demo-company-${DEMO}`;
const PASSWORD = 'Demo12345!';
const canonicalRolePermissions = JSON.parse(
  readFileSync(
    new URL(
      '../../../apps/api/src/roles/company-role-permissions.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

const roleNames = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  SELLER: 'Vendedor',
  WAREHOUSE: 'Almacén',
  ACCOUNTING: 'Contabilidad',
};

const basePermissionCodes = [
  ...new Set([
    ...Object.values(canonicalRolePermissions).flat(),
    'data_export.full_backup',
  ]),
].sort();

const branchesData = [
  [
    'SDQ',
    'Sucursal Principal — Santo Domingo',
    'Santo Domingo',
    'Distrito Nacional',
    true,
  ],
  ['STI', 'Sucursal Santiago', 'Santiago', 'Santiago', false],
  ['LAV', 'Sucursal La Vega', 'La Vega', 'La Vega', false],
];

const usersData = [
  ['OWNER', 'owner@demo.local', 'Dueño Demo', ['SDQ', 'STI', 'LAV']],
  ['ADMIN', 'admin@demo.local', 'Administrador Demo', ['SDQ', 'STI', 'LAV']],
  ['CASHIER', 'cajero@demo.local', 'Cajero Demo', ['SDQ']],
  ['SELLER', 'vendedor@demo.local', 'Vendedor Demo', ['SDQ', 'STI']],
  [
    'WAREHOUSE',
    'almacen@demo.local',
    'Encargado de Almacén Demo',
    ['SDQ', 'STI', 'LAV'],
  ],
  [
    'ACCOUNTING',
    'contabilidad@demo.local',
    'Contabilidad Demo',
    ['SDQ', 'STI', 'LAV'],
  ],
];

const categoriesData = [
  ['Bujías', CategoryType.PRODUCT],
  ['Filtros', CategoryType.PRODUCT],
  ['Aceites', CategoryType.PRODUCT],
  ['Gomas', CategoryType.PRODUCT],
  ['Baterías', CategoryType.PRODUCT],
  ['Frenos', CategoryType.PRODUCT],
  ['Luces', CategoryType.PRODUCT],
  ['Accesorios', CategoryType.PRODUCT],
  ['Servicios', CategoryType.SERVICE],
];
const brandsData = [
  'NGK',
  'Denso',
  'Bosch',
  'Champion',
  'Castrol',
  'Shell',
  'Michelin',
  'Bridgestone',
  'ACDelco',
  'Moura',
];
const unitsData = [
  ['Unidad', 'UND', false],
  ['Galón', 'GAL', true],
  ['Litro', 'L', true],
  ['Juego', 'JGO', false],
  ['Par', 'PAR', false],
  ['Caja', 'CJA', false],
];

const productsData = [
  [
    'BUJ-NGK-BKR6E',
    '890100000001',
    'Bujía NGK BKR6E',
    'Bujías',
    'NGK',
    'UND',
    180,
    320,
    5,
  ],
  [
    'BUJ-DEN-K20PRU',
    '890100000002',
    'Bujía Denso K20PR-U',
    'Bujías',
    'Denso',
    'UND',
    170,
    305,
    5,
  ],
  [
    'BUJ-BOS-FR7DC',
    '890100000003',
    'Bujía Bosch FR7DC',
    'Bujías',
    'Bosch',
    'UND',
    190,
    335,
    5,
  ],
  [
    'BUJ-CHA-RC12YC',
    '890100000004',
    'Bujía Champion RC12YC',
    'Bujías',
    'Champion',
    'UND',
    165,
    295,
    5,
  ],
  [
    'FIL-ACE-COROLLA',
    '890100000005',
    'Filtro de aceite Toyota Corolla',
    'Filtros',
    'Bosch',
    'UND',
    290,
    525,
    4,
  ],
  [
    'FIL-AIR-CIVIC',
    '890100000006',
    'Filtro de aire Honda Civic',
    'Filtros',
    'Denso',
    'UND',
    410,
    725,
    3,
  ],
  [
    'ACE-CAS-GTX20W50',
    '890100000007',
    'Aceite Castrol GTX 20W-50',
    'Aceites',
    'Castrol',
    'GAL',
    1180,
    1750,
    6,
  ],
  [
    'ACE-SHE-HELIX10W30',
    '890100000008',
    'Aceite Shell Helix 10W-30',
    'Aceites',
    'Shell',
    'GAL',
    1240,
    1845,
    6,
  ],
  [
    'GOM-MIC-20555R16',
    '890100000009',
    'Goma Michelin 205/55R16',
    'Gomas',
    'Michelin',
    'UND',
    5400,
    7450,
    4,
  ],
  [
    'GOM-BRI-19565R15',
    '890100000010',
    'Goma Bridgestone 195/65R15',
    'Gomas',
    'Bridgestone',
    'UND',
    4750,
    6650,
    4,
  ],
  [
    'BAT-MOU-12V75',
    '890100000011',
    'Batería Moura 12V 75Ah',
    'Baterías',
    'Moura',
    'UND',
    5200,
    6950,
    3,
  ],
  [
    'FRE-COR-1419',
    '890100000012',
    'Pastillas de freno Corolla 2014-2019',
    'Frenos',
    'ACDelco',
    'JGO',
    1450,
    2350,
    3,
  ],
  [
    'LUC-LED-H4',
    '890100000013',
    'Bombillo LED H4',
    'Luces',
    'Bosch',
    'PAR',
    720,
    1250,
    4,
  ],
  [
    'ACC-LIM-22',
    '890100000014',
    'Limpiaparabrisas universal 22 pulgadas',
    'Accesorios',
    'Bosch',
    'UND',
    310,
    595,
    5,
  ],
];

const stockByBranch = {
  SDQ: [0, 12, 2, 20, 9, 2, 20, 7, 4, 8, 5, 3, 10, 14],
  STI: [8, 4, 9, 1, 3, 6, 5, 12, 0, 3, 1, 7, 3, 2],
  LAV: [3, 0, 2, 6, 1, 4, 8, 15, 2, 1, 2, 0, 5, 8],
};

const customersData = [
  [
    'juan-perez',
    CustomerType.INDIVIDUAL,
    'Juan Pérez',
    CustomerDocumentType.CEDULA,
    '00199999991',
    TaxpayerType.FINAL_CONSUMER,
    '809-555-0111',
    'juan.perez@demo.local',
    'Santo Domingo',
  ],
  [
    'auto-esperanza',
    CustomerType.BUSINESS,
    'Auto Servicio La Esperanza',
    CustomerDocumentType.RNC,
    '131999901',
    TaxpayerType.FISCAL_CONSUMER,
    '809-555-0112',
    'compras@esperanza.demo.local',
    'Santo Domingo',
  ],
  [
    'taller-rodriguez',
    CustomerType.BUSINESS,
    'Taller Rodríguez',
    CustomerDocumentType.RNC,
    '131999902',
    TaxpayerType.FISCAL_CONSUMER,
    '809-555-0113',
    'taller@rodriguez.demo.local',
    'Santiago',
  ],
  [
    'repuestos-diaz',
    CustomerType.BUSINESS,
    'Repuestos Hermanos Díaz',
    CustomerDocumentType.RNC,
    '131999903',
    TaxpayerType.FISCAL_CONSUMER,
    '809-555-0114',
    'compras@diaz.demo.local',
    'La Vega',
  ],
  [
    'maria-gomez',
    CustomerType.INDIVIDUAL,
    'María Gómez',
    CustomerDocumentType.CEDULA,
    '00199999992',
    TaxpayerType.FINAL_CONSUMER,
    '809-555-0115',
    'maria.gomez@demo.local',
    'Santiago',
  ],
  [
    'transporte-caribe',
    CustomerType.BUSINESS,
    'Transporte Caribe SRL',
    CustomerDocumentType.RNC,
    '131999904',
    TaxpayerType.FISCAL_CONSUMER,
    '809-555-0116',
    'operaciones@caribe.demo.local',
    'Santo Domingo',
  ],
];

function requireSafeEnvironment() {
  if (process.env.CONFIRM_SEED_DEMO !== 'true') {
    throw new Error('Seed demo no confirmado. Usa CONFIRM_SEED_DEMO=true.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed demo está bloqueado cuando NODE_ENV=production.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL es requerido.');
  const { hostname } = new URL(databaseUrl);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `El seed demo solo admite bases locales; host recibido: ${hostname}.`,
    );
  }
}

const id = (type, key) =>
  `demo-${type}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const daysAgo = (days, hour = 11) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hour, 0, 0, 0);
  return value;
};

async function seedIdentity(tx) {
  const company = await tx.company.upsert({
    where: { id: COMPANY_ID },
    update: {
      name: 'Repuestos El Capitán SRL',
      legalName: 'Repuestos El Capitán SRL',
      rncOrCedula: '131999999',
      phone: '809-555-0101',
      email: 'demo@comercia.local',
      address: 'Av. 27 de Febrero, Santo Domingo',
      businessType: BusinessType.AUTO_PARTS,
      status: 'ACTIVE',
      deletedAt: null,
    },
    create: {
      id: COMPANY_ID,
      name: 'Repuestos El Capitán SRL',
      legalName: 'Repuestos El Capitán SRL',
      rncOrCedula: '131999999',
      phone: '809-555-0101',
      email: 'demo@comercia.local',
      address: 'Av. 27 de Febrero, Santo Domingo',
      businessType: BusinessType.AUTO_PARTS,
    },
  });
  await tx.businessSettings.upsert({
    where: { companyId: company.id },
    update: {
      taxRate: 18,
      allowNegativeStock: false,
      requireOpenCashForSales: true,
      enabledPaymentMethods: [
        PaymentMethod.CASH,
        PaymentMethod.CARD,
        PaymentMethod.TRANSFER,
        PaymentMethod.CREDIT,
      ],
      receiptFooterText:
        'Gracias por preferir Repuestos El Capitán. Datos de demostración.',
      posShowStock: true,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
    create: {
      companyId: company.id,
      taxRate: 18,
      allowNegativeStock: false,
      requireOpenCashForSales: true,
      enabledPaymentMethods: [
        PaymentMethod.CASH,
        PaymentMethod.CARD,
        PaymentMethod.TRANSFER,
        PaymentMethod.CREDIT,
      ],
      receiptFooterText:
        'Gracias por preferir Repuestos El Capitán. Datos de demostración.',
      posShowStock: true,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
  });

  const branches = {};
  for (const [code, name, city, province, isMain] of branchesData) {
    branches[code] = await tx.branch.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: {
        name,
        city,
        province,
        isMain,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        id: id('branch', code),
        companyId: company.id,
        code,
        name,
        city,
        province,
        isMain,
        address: `${city}, República Dominicana`,
        phone: '809-555-0101',
      },
    });
  }

  for (const code of basePermissionCodes) {
    const module = code.split('.')[0];
    const action = permissionAction(code);
    await tx.permission.upsert({
      where: { code },
      update: { module, action },
      create: { id: id('permission', code), code, module, action },
    });
  }
  const permissions = await tx.permission.findMany({
    orderBy: { code: 'asc' },
  });
  const roles = {};
  for (const code of Object.values(UserRole)) {
    const role = await tx.role.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: { name: roleNames[code], isActive: true },
      create: {
        id: id('role', code),
        companyId: company.id,
        code,
        name: roleNames[code],
      },
    });
    roles[code] = role;
    const allowed =
      code === UserRole.OWNER
        ? permissions
        : permissions.filter((permission) =>
            canonicalRolePermissions[code]?.includes(permission.code),
          );
    for (const permission of allowed) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const passwordHash = await hash(
    PASSWORD,
    Number(process.env.BCRYPT_ROUNDS ?? '12'),
  );
  const users = {};
  for (const [roleCode, email, name, branchCodes] of usersData) {
    const user = await tx.user.upsert({
      where: { email },
      update: {
        companyId: company.id,
        branchId: branches[branchCodes[0]].id,
        roleId: roles[roleCode].id,
        name,
        passwordHash,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        id: id('user', roleCode),
        companyId: company.id,
        branchId: branches[branchCodes[0]].id,
        roleId: roles[roleCode].id,
        name,
        email,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });
    users[roleCode] = user;
    for (const branchCode of branchCodes) {
      await tx.userBranchMembership.upsert({
        where: {
          userId_branchId: {
            userId: user.id,
            branchId: branches[branchCode].id,
          },
        },
        update: {
          companyId: company.id,
          isDefault: branchCode === branchCodes[0],
        },
        create: {
          id: id('membership', `${roleCode}-${branchCode}`),
          companyId: company.id,
          userId: user.id,
          branchId: branches[branchCode].id,
          isDefault: branchCode === branchCodes[0],
        },
      });
    }
  }
  return { company, branches, users };
}

function permissionAction(code) {
  if (/\.(create|open|import)$/.test(code)) return PermissionAction.CREATE;
  if (/\.(disable|change_status|cancel|void)$/.test(code)) {
    return PermissionAction.DISABLE;
  }
  if (
    /\.view($|_)|\.access$|^reports\.|^data_export\.|^financial_dashboard\./.test(
      code,
    )
  ) {
    return PermissionAction.VIEW;
  }
  return PermissionAction.UPDATE;
}

async function ensureLocalPlatformAdmin(tx) {
  const email = 'admin@platform.local';
  const passwordHash = await hash(
    process.env.PLATFORM_ADMIN_PASSWORD ?? 'Admin12345!',
    Number(process.env.BCRYPT_ROUNDS ?? '12'),
  );
  await tx.platformUser.upsert({
    where: { email },
    update: {
      name: 'Platform Admin Local',
      passwordHash,
      role: PlatformRole.SUPER_ADMIN,
      status: PlatformUserStatus.ACTIVE,
    },
    create: {
      id: id('platform-user', 'admin'),
      email,
      name: 'Platform Admin Local',
      passwordHash,
      role: PlatformRole.SUPER_ADMIN,
      status: PlatformUserStatus.ACTIVE,
    },
  });
}

async function ensureDemoSubscription(tx, companyId) {
  const plan = await tx.saasPlan.upsert({
    where: { name: 'Premium' },
    update: {
      maxUsers: 30,
      maxBranches: 10,
      modules: {
        code: 'PREMIUM',
        maxProducts: 20000,
        inventory_transfers: true,
        product_import: true,
        product_compatibility: true,
        fiscal_mock: true,
        data_export_full: true,
        backup_xlsx: true,
        financial_dashboard: true,
        advanced_reports: true,
        priority_support: true,
      },
    },
    create: {
      name: 'Premium',
      description: 'Operacion avanzada para empresas multi-sucursal.',
      price: 5000,
      currency: Currency.DOP,
      billingInterval: SaasBillingInterval.MONTHLY,
      graceDays: 10,
      maxUsers: 30,
      maxBranches: 10,
      modules: {
        code: 'PREMIUM',
        maxProducts: 20000,
        inventory_transfers: true,
        product_import: true,
        product_compatibility: true,
        fiscal_mock: true,
        data_export_full: true,
        backup_xlsx: true,
        financial_dashboard: true,
        advanced_reports: true,
        priority_support: true,
      },
    },
  });
  const startsAt = new Date('2026-07-01T00:00:00.000Z');
  const currentPeriodEnd = new Date('2026-08-01T00:00:00.000Z');
  await tx.companySubscription.upsert({
    where: { companyId },
    update: { planId: plan.id },
    create: {
      companyId,
      planId: plan.id,
      status: CompanySubscriptionStatus.ACTIVE,
      startsAt,
      currentPeriodStart: startsAt,
      currentPeriodEnd,
      nextPaymentDueAt: currentPeriodEnd,
      graceDays: plan.graceDays,
    },
  });
}

async function seedCatalog(tx, companyId, branches, owner) {
  const categories = {};
  for (const [name, type] of categoriesData) {
    categories[name] = await tx.category.upsert({
      where: { companyId_name: { companyId, name } },
      update: { type, status: CatalogStatus.ACTIVE, deletedAt: null },
      create: { id: id('category', name), companyId, name, type },
    });
  }
  const brands = {};
  for (const name of brandsData) {
    brands[name] = await tx.brand.upsert({
      where: { companyId_name: { companyId, name } },
      update: { status: CatalogStatus.ACTIVE, deletedAt: null },
      create: { id: id('brand', name), companyId, name },
    });
  }
  const units = {};
  for (const [name, code, allowsDecimals] of unitsData) {
    units[code] = await tx.unit.upsert({
      where: { companyId_code: { companyId, code } },
      update: { name, allowsDecimals, status: CatalogStatus.ACTIVE },
      create: { id: id('unit', code), companyId, name, code, allowsDecimals },
    });
  }
  const products = {};
  for (const [
    sku,
    barcode,
    name,
    category,
    brand,
    unit,
    cost,
    price,
    minStock,
  ] of productsData) {
    products[sku] = await tx.product.upsert({
      where: { companyId_sku: { companyId, sku } },
      update: {
        name,
        barcode,
        categoryId: categories[category].id,
        brandId: brands[brand].id,
        unitId: units[unit].id,
        cost,
        price,
        taxRate: 18,
        minStock,
        trackInventory: true,
        status: CatalogStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        id: id('product', sku),
        companyId,
        sku,
        barcode,
        name,
        description: 'Producto comercial demo con ITBIS incluido.',
        categoryId: categories[category].id,
        brandId: brands[brand].id,
        unitId: units[unit].id,
        cost,
        price,
        taxRate: 18,
        minStock,
        trackInventory: true,
      },
    });
  }
  await tx.service.upsert({
    where: { id: id('service', 'instalacion-balanceo') },
    update: {
      name: 'Instalación y balanceo de gomas',
      price: 850,
      status: CatalogStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      id: id('service', 'instalacion-balanceo'),
      companyId,
      categoryId: categories.Servicios.id,
      name: 'Instalación y balanceo de gomas',
      description: 'Servicio demo por vehículo',
      price: 850,
      taxRate: 18,
      durationMinutes: 45,
    },
  });

  for (const [branchCode, quantities] of Object.entries(stockByBranch)) {
    for (let index = 0; index < productsData.length; index += 1) {
      const sku = productsData[index][0];
      const product = products[sku];
      const quantity = quantities[index];
      const minStock = productsData[index][8];
      await tx.productBranchStock.upsert({
        where: {
          companyId_branchId_productId: {
            companyId,
            branchId: branches[branchCode].id,
            productId: product.id,
          },
        },
        update: { quantity, minStock },
        create: {
          id: id('stock', `${branchCode}-${sku}`),
          companyId,
          branchId: branches[branchCode].id,
          productId: product.id,
          quantity,
          minStock,
        },
      });
    }
  }
  for (const [index, [sku]] of productsData.entries()) {
    const total = Object.values(stockByBranch).reduce(
      (sum, values) => sum + values[index],
      0,
    );
    await tx.product.update({
      where: { id: products[sku].id },
      data: { stock: total },
    });
  }

  const group = await tx.productCompatibilityGroup.upsert({
    where: { companyId_code: { companyId, code: 'BUJIA-BKR6E-EQUIV' } },
    update: {
      name: 'Equivalencias bujía BKR6E',
      status: ProductCompatibilityGroupStatus.ACTIVE,
    },
    create: {
      id: id('compatibility', 'BUJIA-BKR6E-EQUIV'),
      companyId,
      code: 'BUJIA-BKR6E-EQUIV',
      name: 'Equivalencias bujía BKR6E',
      description:
        'Alternativas comerciales equivalentes para demostración POS.',
    },
  });
  const compatible = [
    ['BUJ-NGK-BKR6E', 'BKR6E'],
    ['BUJ-DEN-K20PRU', 'K20PR-U'],
    ['BUJ-BOS-FR7DC', 'FR7DC'],
    ['BUJ-CHA-RC12YC', 'RC12YC'],
  ];
  for (const [sku, code] of compatible) {
    await tx.productCompatibilityGroupItem.upsert({
      where: {
        groupId_productId: { groupId: group.id, productId: products[sku].id },
      },
      update: { companyId },
      create: {
        id: id('compatibility-item', sku),
        companyId,
        groupId: group.id,
        productId: products[sku].id,
      },
    });
    await tx.productAlternativeCode.upsert({
      where: { companyId_code: { companyId, code } },
      update: {
        productId: products[sku].id,
        type: ProductAlternativeCodeType.OEM,
      },
      create: {
        id: id('alternative-code', code),
        companyId,
        productId: products[sku].id,
        code,
        type: ProductAlternativeCodeType.OEM,
      },
    });
  }
  for (const [targetSku, priority] of [
    ['BUJ-DEN-K20PRU', 1],
    ['BUJ-BOS-FR7DC', 2],
  ]) {
    await tx.productSubstitute.upsert({
      where: {
        companyId_productId_substituteProductId: {
          companyId,
          productId: products['BUJ-NGK-BKR6E'].id,
          substituteProductId: products[targetSku].id,
        },
      },
      update: {
        type: ProductSubstituteType.EQUIVALENT,
        isBidirectional: true,
        priority,
      },
      create: {
        id: id('substitute', targetSku),
        companyId,
        productId: products['BUJ-NGK-BKR6E'].id,
        substituteProductId: products[targetSku].id,
        type: ProductSubstituteType.EQUIVALENT,
        notes: 'Equivalencia demo validada para el flujo comercial.',
        isBidirectional: true,
        priority,
      },
    });
  }

  await tx.inventoryMovement.upsert({
    where: { id: id('movement', 'initial-demo-stock') },
    update: {},
    create: {
      id: id('movement', 'initial-demo-stock'),
      companyId,
      branchId: branches.SDQ.id,
      productId: products['ACE-CAS-GTX20W50'].id,
      type: InventoryMovementType.PURCHASE_IN,
      quantity: 20,
      unitCost: 1180,
      previousStock: 0,
      newStock: 20,
      reason: 'Carga inicial de inventario demo',
      referenceType: 'DEMO_SEED',
      referenceId: DEMO,
      createdById: owner.id,
      createdAt: daysAgo(12),
    },
  });
  return products;
}

async function seedCustomers(tx, companyId) {
  const customers = {};
  for (const [
    key,
    type,
    name,
    documentType,
    documentNumber,
    taxpayerType,
    phone,
    email,
    city,
  ] of customersData) {
    customers[key] = await tx.customer.upsert({
      where: { companyId_documentNumber: { companyId, documentNumber } },
      update: {
        type,
        name,
        documentType,
        taxpayerType,
        phone,
        email,
        city,
        status: CustomerStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        id: id('customer', key),
        companyId,
        type,
        name,
        documentType,
        documentNumber,
        taxpayerType,
        phone,
        email,
        city,
        province: city === 'Santo Domingo' ? 'Distrito Nacional' : city,
        country: 'República Dominicana',
        address: `Dirección comercial demo, ${city}`,
      },
    });
  }
  return customers;
}

function saleMath(unitPrice, quantity) {
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const taxTotal = Number((subtotal * 0.18).toFixed(2));
  return {
    subtotal,
    taxTotal,
    total: Number((subtotal + taxTotal).toFixed(2)),
  };
}

async function seedSalesAndCash(
  tx,
  companyId,
  branches,
  users,
  products,
  customers,
) {
  const sessions = {
    open: await tx.cashSession.upsert({
      where: { id: id('cash-session', 'today-sdq') },
      update: {
        status: CashSessionStatus.OPEN,
        openedAt: daysAgo(0, 8),
        closedAt: null,
        closedById: null,
        expectedCashAmount: 5737.5,
        salesCashTotal: 737.5,
      },
      create: {
        id: id('cash-session', 'today-sdq'),
        companyId,
        branchId: branches.SDQ.id,
        openedById: users.CASHIER.id,
        status: CashSessionStatus.OPEN,
        openingAmount: 5000,
        expectedCashAmount: 5737.5,
        salesCashTotal: 737.5,
        notes: 'Caja abierta para demo comercial',
        openedAt: daysAgo(0, 8),
      },
    }),
    closed: await tx.cashSession.upsert({
      where: { id: id('cash-session', 'previous-sdq') },
      update: {
        openedAt: daysAgo(3, 8),
        closedAt: daysAgo(3, 18),
        expectedCashAmount: 5239,
        countedCashAmount: 5239,
        differenceAmount: 0,
        salesCashTotal: 1239,
      },
      create: {
        id: id('cash-session', 'previous-sdq'),
        companyId,
        branchId: branches.SDQ.id,
        openedById: users.CASHIER.id,
        closedById: users.CASHIER.id,
        status: CashSessionStatus.CLOSED,
        openingAmount: 4000,
        expectedCashAmount: 5239,
        countedCashAmount: 5239,
        differenceAmount: 0,
        salesCashTotal: 1239,
        notes: 'Cierre demo cuadrado',
        openedAt: daysAgo(3, 8),
        closedAt: daysAgo(3, 18),
      },
    }),
    santiago: await tx.cashSession.upsert({
      where: { id: id('cash-session', 'previous-sti') },
      update: {
        openedAt: daysAgo(6, 8),
        closedAt: daysAgo(6, 17),
        expectedCashAmount: 5773,
        countedCashAmount: 5773,
        differenceAmount: 0,
        salesCashTotal: 2773,
      },
      create: {
        id: id('cash-session', 'previous-sti'),
        companyId,
        branchId: branches.STI.id,
        openedById: users.SELLER.id,
        closedById: users.SELLER.id,
        status: CashSessionStatus.CLOSED,
        openingAmount: 3000,
        expectedCashAmount: 5773,
        countedCashAmount: 5773,
        differenceAmount: 0,
        salesCashTotal: 2773,
        notes: 'Caja Santiago demo',
        openedAt: daysAgo(6, 8),
        closedAt: daysAgo(6, 17),
      },
    }),
  };
  await tx.cashMovement.upsert({
    where: { id: id('cash-movement', 'opening-today') },
    update: {},
    create: {
      id: id('cash-movement', 'opening-today'),
      companyId,
      branchId: branches.SDQ.id,
      cashSessionId: sessions.open.id,
      type: CashMovementType.OPENING,
      amount: 5000,
      reason: 'Apertura de caja demo',
      referenceType: 'CASH_SESSION',
      referenceId: sessions.open.id,
      createdById: users.CASHIER.id,
      createdAt: daysAgo(0, 8),
    },
  });

  const salesData = [
    [
      '000001',
      'SDQ',
      'open',
      'juan-perez',
      'BUJ-DEN-K20PRU',
      305,
      4,
      PaymentMethod.CASH,
      0,
      SaleStatus.COMPLETED,
    ],
    [
      '000002',
      'SDQ',
      'open',
      'auto-esperanza',
      'ACE-CAS-GTX20W50',
      1750,
      2,
      PaymentMethod.CARD,
      0,
      SaleStatus.COMPLETED,
    ],
    [
      '000003',
      'SDQ',
      'closed',
      'transporte-caribe',
      'GOM-MIC-20555R16',
      7450,
      2,
      PaymentMethod.TRANSFER,
      3,
      SaleStatus.COMPLETED,
    ],
    [
      '000004',
      'STI',
      'santiago',
      'taller-rodriguez',
      'FRE-COR-1419',
      2350,
      1,
      PaymentMethod.CASH,
      6,
      SaleStatus.COMPLETED,
    ],
    [
      '000005',
      'LAV',
      null,
      'repuestos-diaz',
      'BAT-MOU-12V75',
      6950,
      1,
      PaymentMethod.CREDIT,
      10,
      SaleStatus.COMPLETED,
    ],
    [
      '000006',
      'STI',
      'santiago',
      'maria-gomez',
      'LUC-LED-H4',
      1250,
      1,
      PaymentMethod.CARD,
      14,
      SaleStatus.COMPLETED,
    ],
    [
      '000007',
      'SDQ',
      'closed',
      'juan-perez',
      'FIL-ACE-COROLLA',
      525,
      2,
      PaymentMethod.CASH,
      20,
      SaleStatus.COMPLETED,
    ],
    [
      '000008',
      'SDQ',
      'open',
      'juan-perez',
      'ACC-LIM-22',
      595,
      1,
      PaymentMethod.CASH,
      1,
      SaleStatus.CANCELLED,
    ],
  ];
  const sales = {};
  for (const [
    number,
    branchCode,
    sessionKey,
    customerKey,
    sku,
    unitPrice,
    quantity,
    method,
    age,
    status,
  ] of salesData) {
    const amounts = saleMath(unitPrice, quantity);
    const saleNumber = `DEMO-${number}`;
    const cashSession = sessionKey ? sessions[sessionKey] : null;
    const sale = await tx.sale.upsert({
      where: { companyId_saleNumber: { companyId, saleNumber } },
      update: {
        branchId: branches[branchCode].id,
        customerId: customers[customerKey].id,
        cashSessionId: cashSession?.id,
        status,
        subtotal: amounts.subtotal,
        taxTotal: amounts.taxTotal,
        total: amounts.total,
        paidTotal: method === PaymentMethod.CREDIT ? 0 : amounts.total,
        balanceDue: method === PaymentMethod.CREDIT ? amounts.total : 0,
        cancelledById: status === SaleStatus.CANCELLED ? users.ADMIN.id : null,
        cancelledAt: status === SaleStatus.CANCELLED ? daysAgo(age, 15) : null,
        cancelReason:
          status === SaleStatus.CANCELLED ? 'Cancelación demostrativa' : null,
        createdAt: daysAgo(age),
      },
      create: {
        id: id('sale', number),
        companyId,
        branchId: branches[branchCode].id,
        customerId: customers[customerKey].id,
        cashSessionId: cashSession?.id,
        saleNumber,
        status,
        subtotal: amounts.subtotal,
        taxTotal: amounts.taxTotal,
        discountTotal: 0,
        total: amounts.total,
        paidTotal: method === PaymentMethod.CREDIT ? 0 : amounts.total,
        balanceDue: method === PaymentMethod.CREDIT ? amounts.total : 0,
        notes: 'Venta generada por el seed comercial demo',
        createdById: users.SELLER.id,
        cancelledById: status === SaleStatus.CANCELLED ? users.ADMIN.id : null,
        cancelledAt: status === SaleStatus.CANCELLED ? daysAgo(age, 15) : null,
        cancelReason:
          status === SaleStatus.CANCELLED ? 'Cancelación demostrativa' : null,
        createdAt: daysAgo(age),
      },
    });
    sales[number] = sale;
    const item = await tx.saleItem.upsert({
      where: { id: id('sale-item', number) },
      update: {
        quantity,
        unitPrice,
        subtotal: amounts.subtotal,
        taxTotal: amounts.taxTotal,
        total: amounts.total,
      },
      create: {
        id: id('sale-item', number),
        companyId,
        saleId: sale.id,
        itemType: SaleItemType.PRODUCT,
        productId: products[sku].id,
        name: products[sku].name,
        quantity,
        unitPrice,
        taxRate: 18,
        discountAmount: 0,
        subtotal: amounts.subtotal,
        taxTotal: amounts.taxTotal,
        total: amounts.total,
        affectsInventory: true,
      },
    });
    if (method !== PaymentMethod.CREDIT) {
      await tx.payment.upsert({
        where: { id: id('payment', number) },
        update: {
          method,
          amount: amounts.total,
          cashSessionId: cashSession?.id,
          createdAt: daysAgo(age, 12),
        },
        create: {
          id: id('payment', number),
          companyId,
          saleId: sale.id,
          cashSessionId: cashSession?.id,
          method,
          amount: amounts.total,
          reference:
            method === PaymentMethod.CASH ? null : `DEMO-${method}-${number}`,
          notes: 'Pago demo',
          createdById: users.CASHIER.id,
          createdAt: daysAgo(age, 12),
        },
      });
    }
    await tx.inventoryMovement.upsert({
      where: { id: id('movement', `sale-${number}`) },
      update: {},
      create: {
        id: id('movement', `sale-${number}`),
        companyId,
        branchId: branches[branchCode].id,
        productId: products[sku].id,
        type:
          status === SaleStatus.CANCELLED
            ? InventoryMovementType.VOID_SALE_IN
            : InventoryMovementType.SALE_OUT,
        quantity,
        unitCost: products[sku].cost,
        previousStock: status === SaleStatus.CANCELLED ? 13 : 14,
        newStock: status === SaleStatus.CANCELLED ? 14 : 13,
        reason:
          status === SaleStatus.CANCELLED
            ? 'Reverso de venta demo cancelada'
            : 'Venta comercial demo',
        referenceType: 'SALE',
        referenceId: sale.id,
        createdById: users.SELLER.id,
        createdAt: daysAgo(age, 12),
      },
    });
    if (method === PaymentMethod.CASH && cashSession) {
      await tx.cashMovement.upsert({
        where: { id: id('cash-movement', `sale-${number}`) },
        update: {},
        create: {
          id: id('cash-movement', `sale-${number}`),
          companyId,
          branchId: branches[branchCode].id,
          cashSessionId: cashSession.id,
          type:
            status === SaleStatus.CANCELLED
              ? CashMovementType.SALE_CANCELLED_OUT
              : CashMovementType.SALE_CASH_IN,
          amount: amounts.total,
          reason:
            status === SaleStatus.CANCELLED
              ? 'Reverso efectivo venta demo'
              : 'Cobro efectivo venta demo',
          referenceType: 'SALE',
          referenceId: sale.id,
          saleId: sale.id,
          createdById: users.CASHIER.id,
          createdAt: daysAgo(age, 12),
        },
      });
    }
    if (status === SaleStatus.COMPLETED && Number(number) <= 4) {
      const document = await tx.internalDocument.upsert({
        where: {
          companyId_documentType_documentNumber: {
            companyId,
            documentType: InternalDocumentType.INTERNAL_INVOICE,
            documentNumber: `DEMO-FI-${number}`,
          },
        },
        update: { createdAt: daysAgo(age, 12) },
        create: {
          id: id('document', number),
          companyId,
          branchId: branches[branchCode].id,
          saleId: sale.id,
          customerId: customers[customerKey].id,
          documentNumber: `DEMO-FI-${number}`,
          documentType: InternalDocumentType.INTERNAL_INVOICE,
          status: InternalDocumentStatus.ISSUED,
          subtotal: amounts.subtotal,
          taxTotal: amounts.taxTotal,
          discountTotal: 0,
          total: amounts.total,
          paidTotal: method === PaymentMethod.CREDIT ? 0 : amounts.total,
          balanceDue: method === PaymentMethod.CREDIT ? amounts.total : 0,
          notes: 'Documento interno demo; no es comprobante fiscal.',
          createdById: users.SELLER.id,
          createdAt: daysAgo(age, 12),
        },
      });
      await tx.internalDocumentItem.upsert({
        where: { id: id('document-item', number) },
        update: {},
        create: {
          id: id('document-item', number),
          companyId,
          documentId: document.id,
          saleItemId: item.id,
          itemType: SaleItemType.PRODUCT,
          productId: products[sku].id,
          name: products[sku].name,
          quantity,
          unitPrice,
          taxRate: 18,
          discountAmount: 0,
          subtotal: amounts.subtotal,
          taxTotal: amounts.taxTotal,
          total: amounts.total,
        },
      });
    }
  }
  return sales;
}

async function seedTransfersAndFiscal(
  tx,
  companyId,
  branches,
  users,
  products,
  customers,
  sales,
) {
  const transfers = [
    ['SDQ-STI', 'SDQ', 'STI', 'ACE-CAS-GTX20W50', 4, 5],
    ['STI-LAV', 'STI', 'LAV', 'BUJ-NGK-BKR6E', 3, 2],
  ];
  for (const [key, from, to, sku, quantity, age] of transfers) {
    const transfer = await tx.inventoryTransfer.upsert({
      where: { id: id('transfer', key) },
      update: { createdAt: daysAgo(age, 14) },
      create: {
        id: id('transfer', key),
        companyId,
        fromBranchId: branches[from].id,
        toBranchId: branches[to].id,
        status: InventoryTransferStatus.COMPLETED,
        note: `Transferencia demo ${from} → ${to}`,
        createdById: users.WAREHOUSE.id,
        createdAt: daysAgo(age, 14),
      },
    });
    await tx.inventoryTransferItem.upsert({
      where: { id: id('transfer-item', key) },
      update: { quantity },
      create: {
        id: id('transfer-item', key),
        companyId,
        transferId: transfer.id,
        productId: products[sku].id,
        quantity,
      },
    });
  }

  const provider = await tx.fiscalProvider.upsert({
    where: { companyId_code: { companyId, code: 'COMERCIA_MOCK_DEMO' } },
    update: {
      name: 'Proveedor mock Comercia Demo',
      mode: FiscalProviderMode.MOCK,
      status: FiscalProviderStatus.ACTIVE,
    },
    create: {
      id: id('fiscal-provider', 'mock'),
      companyId,
      code: 'COMERCIA_MOCK_DEMO',
      name: 'Proveedor mock Comercia Demo',
      mode: FiscalProviderMode.MOCK,
      status: FiscalProviderStatus.ACTIVE,
    },
  });
  await tx.fiscalSettings.upsert({
    where: { companyId },
    update: {
      rnc: '131999999',
      legalName: 'Repuestos El Capitán SRL',
      commercialName: 'Repuestos El Capitán',
      economicActivity: 'Repuestos, gomas y lubricantes',
      fiscalAddress: 'Av. 27 de Febrero, Santo Domingo',
      province: 'Distrito Nacional',
      municipality: 'Santo Domingo',
      environment: FiscalEnvironment.SANDBOX,
      providerMode: FiscalProviderMode.MOCK,
      activeProviderId: provider.id,
      enabled: true,
    },
    create: {
      companyId,
      rnc: '131999999',
      legalName: 'Repuestos El Capitán SRL',
      commercialName: 'Repuestos El Capitán',
      economicActivity: 'Repuestos, gomas y lubricantes',
      fiscalAddress: 'Av. 27 de Febrero, Santo Domingo',
      province: 'Distrito Nacional',
      municipality: 'Santo Domingo',
      environment: FiscalEnvironment.SANDBOX,
      providerMode: FiscalProviderMode.MOCK,
      activeProviderId: provider.id,
      enabled: true,
    },
  });
  for (const [number, status] of [
    ['000001', ElectronicInvoiceStatus.ACCEPTED],
    ['000003', ElectronicInvoiceStatus.SENT],
  ]) {
    const sale = sales[number];
    const invoice = await tx.electronicInvoice.upsert({
      where: { id: id('electronic-invoice', number) },
      update: { status, createdAt: sale.createdAt },
      create: {
        id: id('electronic-invoice', number),
        companyId,
        branchId: sale.branchId,
        saleId: sale.id,
        customerId:
          number === '000001'
            ? customers['juan-perez'].id
            : customers['transporte-caribe'].id,
        documentType: ElectronicDocumentType.INTERNAL_TEST,
        status,
        fiscalNumber: `MOCK-E32-${number}`,
        providerDocumentId: `MOCK-DOC-${number}`,
        providerTrackId: `MOCK-TRACK-${number}`,
        payload: {
          sandbox: true,
          source: 'commercial_demo_seed',
          saleNumber: sale.saleNumber,
          disclaimer: 'No válido para facturación electrónica real.',
        },
        response: {
          mock: true,
          status,
          message: 'Respuesta simulada; no enviada a DGII.',
        },
        sentAt: sale.createdAt,
        acceptedAt:
          status === ElectronicInvoiceStatus.ACCEPTED ? sale.createdAt : null,
        createdById: users.ACCOUNTING.id,
        createdAt: sale.createdAt,
      },
    });
    await tx.electronicInvoiceEvent.upsert({
      where: { id: id('electronic-event', number) },
      update: { eventType: `MOCK_${status}` },
      create: {
        id: id('electronic-event', number),
        companyId,
        electronicInvoiceId: invoice.id,
        eventType: `MOCK_${status}`,
        message: 'Evento fiscal simulado para la demo comercial.',
        payload: { sandbox: true, noRealDgiiSubmission: true },
        createdAt: sale.createdAt,
      },
    });
  }
}

async function verifyDemo() {
  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          branches: true,
          users: true,
          products: true,
          customers: true,
          sales: true,
          productBranchStocks: true,
          inventoryTransfers: true,
          internalDocuments: true,
          electronicInvoices: true,
        },
      },
    },
  });
  if (!company) throw new Error('La empresa demo no fue creada.');
  const expected = {
    branches: 3,
    users: 6,
    products: 14,
    customers: 6,
    sales: 8,
  };
  for (const [key, minimum] of Object.entries(expected)) {
    if (company._count[key] < minimum)
      throw new Error(`Validación demo falló: ${key} < ${minimum}.`);
  }
  return company;
}

async function main() {
  requireSafeEnvironment();
  console.warn(
    'ADVERTENCIA: se crearán o actualizarán únicamente datos identificados como demo.',
  );
  console.warn('No se eliminarán empresas ni datos existentes.');
  await prisma.$transaction(
    async (tx) => {
      await ensureLocalPlatformAdmin(tx);
      const { company, branches, users } = await seedIdentity(tx);
      await ensureDemoSubscription(tx, company.id);
      const products = await seedCatalog(tx, company.id, branches, users.OWNER);
      const customers = await seedCustomers(tx, company.id);
      const sales = await seedSalesAndCash(
        tx,
        company.id,
        branches,
        users,
        products,
        customers,
      );
      await seedTransfersAndFiscal(
        tx,
        company.id,
        branches,
        users,
        products,
        customers,
        sales,
      );
      await tx.auditLog.upsert({
        where: { id: id('audit', 'seed-completed') },
        update: {
          description: 'Seed comercial demo actualizado de forma idempotente',
        },
        create: {
          id: id('audit', 'seed-completed'),
          companyId: company.id,
          branchId: branches.SDQ.id,
          userId: users.OWNER.id,
          action: 'COMMERCIAL_DEMO_SEEDED',
          module: 'demo',
          entityType: 'Company',
          entityId: company.id,
          description: 'Seed comercial demo creado de forma idempotente',
          metadataJson: { demoIdentifier: DEMO, destructive: false },
        },
      });
    },
    { timeout: 120_000 },
  );
  const result = await verifyDemo();
  console.log('Demo comercial lista.');
  console.table([{ empresa: result.name, ...result._count }]);
  console.log('Acceso local: owner@demo.local / Demo12345!');
}

main()
  .catch((error) => {
    console.error('El seed comercial demo falló.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
