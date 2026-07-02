import {
  BusinessType,
  Currency,
  DocumentType,
  PaymentMethod,
  type Prisma,
} from '@prisma/client';

export interface BusinessTemplateDefinition {
  id: BusinessType;
  name: string;
  description: string;
  futureCapabilities: string[];
  settings: Prisma.BusinessSettingsUpdateInput;
}

const STANDARD_PAYMENTS = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.TRANSFER,
];

const BASE_SETTINGS = {
  currency: Currency.DOP,
  taxRate: 18,
  allowNegativeStock: false,
  requireOpenCashForSales: true,
  defaultDocumentType: DocumentType.INTERNAL_RECEIPT,
  defaultPaymentMethod: PaymentMethod.CASH,
  enabledPaymentMethods: STANDARD_PAYMENTS,
  printLogo: true,
  posQuickSaleMode: false,
  posShowStock: true,
  posAllowDiscounts: true,
  cashRequireOpeningAmount: true,
  cashAllowExpenses: true,
} satisfies Prisma.BusinessSettingsUpdateInput;

function template(
  id: BusinessType,
  name: string,
  description: string,
  futureCapabilities: string[],
  overrides: Prisma.BusinessSettingsUpdateInput = {},
): BusinessTemplateDefinition {
  return {
    id,
    name,
    description,
    futureCapabilities,
    settings: { ...BASE_SETTINGS, ...overrides },
  };
}

export const BUSINESS_TEMPLATES: Record<
  BusinessType,
  BusinessTemplateDefinition
> = {
  SMALL_STORE: template(
    BusinessType.SMALL_STORE,
    'Tienda pequeña',
    'Configuración general para ventas de productos.',
    ['PRODUCTS', 'OPTIONAL_SERVICES', 'CUSTOMERS'],
  ),
  BEAUTY_SALON: template(
    BusinessType.BEAUTY_SALON,
    'Salón de belleza',
    'Operación orientada a servicios con productos opcionales.',
    ['SERVICES', 'OPTIONAL_PRODUCTS', 'APPOINTMENTS'],
    { requireOpenCashForSales: false, posShowStock: false },
  ),
  BARBERSHOP: template(
    BusinessType.BARBERSHOP,
    'Barbería',
    'Operación rápida orientada a servicios.',
    ['SERVICES', 'OPTIONAL_PRODUCTS', 'APPOINTMENTS'],
    { requireOpenCashForSales: false, posShowStock: false },
  ),
  MINIMARKET: template(
    BusinessType.MINIMARKET,
    'Minimarket',
    'Venta rápida con control de stock visible.',
    ['PRODUCTS', 'BARCODES', 'CUSTOMERS'],
    { posQuickSaleMode: true },
  ),
  GROCERY: template(
    BusinessType.GROCERY,
    'Colmado',
    'Venta rápida y sencilla para comercios de proximidad.',
    ['PRODUCTS', 'BARCODES', 'CUSTOMERS'],
    { posQuickSaleMode: true },
  ),
  TIRE_SHOP: template(
    BusinessType.TIRE_SHOP,
    'Gomera',
    'Productos y servicios con caja y stock visibles.',
    ['PRODUCTS', 'SERVICES', 'CUSTOMERS'],
  ),
  AUTO_PARTS: template(
    BusinessType.AUTO_PARTS,
    'Repuestos',
    'Catálogo de productos con soporte futuro para clientes fiscales.',
    ['PRODUCTS', 'FISCAL_CUSTOMERS', 'SUPPLIERS'],
  ),
  HARDWARE_STORE: template(
    BusinessType.HARDWARE_STORE,
    'Ferretería',
    'Productos con stock visible y descuentos controlados.',
    ['PRODUCTS', 'CUSTOMERS', 'SUPPLIERS'],
  ),
  CLOTHING_STORE: template(
    BusinessType.CLOTHING_STORE,
    'Tienda de ropa',
    'Venta de productos con descuentos habilitados.',
    ['PRODUCTS', 'CUSTOMERS', 'VARIANTS'],
  ),
  PHONE_STORE: template(
    BusinessType.PHONE_STORE,
    'Tienda de celulares',
    'Productos y servicios con trazabilidad futura de equipos.',
    ['PRODUCTS', 'SERVICES', 'SERIALS'],
  ),
  COSMETICS_STORE: template(
    BusinessType.COSMETICS_STORE,
    'Tienda de cosméticos',
    'Venta de productos con stock y descuentos visibles.',
    ['PRODUCTS', 'CUSTOMERS', 'SUPPLIERS'],
  ),
  SERVICE_BUSINESS: template(
    BusinessType.SERVICE_BUSINESS,
    'Negocio de servicios',
    'Configuración sin dependencia de inventario.',
    ['SERVICES', 'CUSTOMERS'],
    {
      requireOpenCashForSales: false,
      posShowStock: false,
      cashRequireOpeningAmount: false,
    },
  ),
  OTHER: template(
    BusinessType.OTHER,
    'Otro negocio',
    'Configuración general que puede ajustarse manualmente.',
    ['PRODUCTS', 'SERVICES', 'CUSTOMERS'],
  ),
};

export function listBusinessTemplates() {
  return Object.values(BUSINESS_TEMPLATES);
}
