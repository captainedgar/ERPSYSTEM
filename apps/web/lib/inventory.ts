import { CatalogStatus, InventoryMovementType } from '@comercia/shared';

import { apiRequest } from './api';

export interface InventoryProduct {
  id: string;
  companyId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stock: string | number;
  minStock: string | number;
  trackInventory: boolean;
  status: CatalogStatus;
  category: { id: string; name: string; type: string } | null;
  brand: { id: string; name: string } | null;
  unit: { id: string; name: string; code: string } | null;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantity: string | number;
  unitCost: string | number | null;
  previousStock: string | number;
  newStock: string | number;
  reason: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string } | null;
}

export interface InventoryListResponse {
  items: InventoryProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface InventoryMovementsResponse {
  product: {
    id: string;
    name: string;
    stock: string | number;
    minStock: string | number;
    unit: { id: string; name: string; code: string } | null;
  };
  items: InventoryMovement[];
  total: number;
  page: number;
  limit: number;
}

export function getInventory(params: URLSearchParams) {
  const query = params.toString();
  return apiRequest<InventoryListResponse>(
    `/inventory${query ? `?${query}` : ''}`,
  );
}

export function getLowStockInventory(params: URLSearchParams) {
  const query = params.toString();
  return apiRequest<InventoryListResponse>(
    `/inventory/low-stock${query ? `?${query}` : ''}`,
  );
}

export function getInventoryMovements(
  productId: string,
  params: URLSearchParams,
) {
  const query = params.toString();
  return apiRequest<InventoryMovementsResponse>(
    `/inventory/products/${productId}/movements${query ? `?${query}` : ''}`,
  );
}

export function createManualEntry(
  productId: string,
  payload: { quantity: number; unitCost?: number; reason: string },
) {
  return apiRequest(`/inventory/products/${productId}/manual-entry`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createInventoryAdjustment(
  productId: string,
  payload: {
    type:
      | InventoryMovementType.ADJUSTMENT_IN
      | InventoryMovementType.ADJUSTMENT_OUT;
    quantity: number;
    reason: string;
  },
) {
  return apiRequest(`/inventory/products/${productId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export { CatalogStatus, InventoryMovementType };
