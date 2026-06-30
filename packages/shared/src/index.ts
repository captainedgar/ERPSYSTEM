export enum BusinessType {
  GROCERY_STORE = 'GROCERY_STORE',
  MINIMARKET = 'MINIMARKET',
  BEAUTY_SALON = 'BEAUTY_SALON',
  BARBERSHOP = 'BARBERSHOP',
  TIRE_SHOP = 'TIRE_SHOP',
  AUTO_PARTS = 'AUTO_PARTS',
  HARDWARE_STORE = 'HARDWARE_STORE',
  CLOTHING_STORE = 'CLOTHING_STORE',
  MOBILE_STORE = 'MOBILE_STORE',
  SERVICES = 'SERVICES',
  OTHER = 'OTHER',
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum FiscalStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}
