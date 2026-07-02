import { CatalogStatus, CategoryType } from '@comercia/shared';

import { apiRequest } from './api';

export type CatalogKind =
  'categories' | 'brands' | 'units' | 'products' | 'services';

export interface CatalogEntity {
  id: string;
  companyId: string;
  name: string;
  status: CatalogStatus;
  description?: string | null;
}

export interface Category extends CatalogEntity {
  type: CategoryType;
}

export type Brand = CatalogEntity;

export interface Unit extends CatalogEntity {
  code: string;
  allowsDecimals: boolean;
}

export interface Product extends CatalogEntity {
  categoryId: string | null;
  brandId: string | null;
  unitId: string | null;
  sku: string | null;
  barcode: string | null;
  cost: string | number;
  price: string | number;
  taxRate: string | number;
  stock: string | number;
  minStock: string | number;
  trackInventory: boolean;
  allowDiscount: boolean;
  imageUrl: string | null;
  category: Pick<Category, 'id' | 'name' | 'type'> | null;
  brand: Pick<Brand, 'id' | 'name'> | null;
  unit: Pick<Unit, 'id' | 'name' | 'code'> | null;
}

export interface Service extends CatalogEntity {
  categoryId: string | null;
  price: string | number;
  taxRate: string | number;
  durationMinutes: number | null;
  allowDiscount: boolean;
  category: Pick<Category, 'id' | 'name' | 'type'> | null;
}

export function listCatalog<T>(kind: CatalogKind, search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<T[]>(`/${kind}${query}`);
}

export function createCatalog<T>(
  kind: CatalogKind,
  payload: Record<string, unknown>,
) {
  return apiRequest<T>(`/${kind}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCatalog<T>(
  kind: CatalogKind,
  id: string,
  payload: Record<string, unknown>,
) {
  return apiRequest<T>(`/${kind}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateCatalogStatus<T>(
  kind: CatalogKind,
  id: string,
  status: CatalogStatus,
) {
  return apiRequest<T>(`/${kind}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export { CatalogStatus, CategoryType };
