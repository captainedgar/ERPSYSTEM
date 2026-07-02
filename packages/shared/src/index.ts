export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  SELLER = 'SELLER',
  WAREHOUSE = 'WAREHOUSE',
  ACCOUNTING = 'ACCOUNTING',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  INVITED = 'INVITED',
}

export enum BusinessType {
  SMALL_STORE = 'SMALL_STORE',
  BEAUTY_SALON = 'BEAUTY_SALON',
  BARBERSHOP = 'BARBERSHOP',
  MINIMARKET = 'MINIMARKET',
  GROCERY = 'GROCERY',
  TIRE_SHOP = 'TIRE_SHOP',
  AUTO_PARTS = 'AUTO_PARTS',
  HARDWARE_STORE = 'HARDWARE_STORE',
  CLOTHING_STORE = 'CLOTHING_STORE',
  PHONE_STORE = 'PHONE_STORE',
  COSMETICS_STORE = 'COSMETICS_STORE',
  SERVICE_BUSINESS = 'SERVICE_BUSINESS',
  OTHER = 'OTHER',
}

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PermissionAction {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DISABLE = 'DISABLE',
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}
