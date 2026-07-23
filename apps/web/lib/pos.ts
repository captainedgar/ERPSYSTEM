import { PosItemType, PosSearchType } from '@comercia/shared';

import { apiRequest } from './api';

export interface PosItem {
  id: string;
  type: PosItemType;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sku: string | null;
  barcode: string | null;
  price: string | number;
  taxRate: string | number;
  stock: string | number | null;
  trackInventory: boolean;
  allowDiscount: boolean;
  status: 'ACTIVE';
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  unit: { id: string; name: string; code: string } | null;
}

export interface PosSearchResponse {
  items: PosItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CartValidationError {
  code: string;
  message: string;
  itemIndex?: number;
  itemId?: string;
}

export interface CalculatedCartItem {
  itemId: string;
  itemType: PosItemType;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  lineSubtotal: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CartValidationResponse {
  valid: boolean;
  errors: CartValidationError[];
  warnings: CartValidationError[];
  customer: {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string | null;
  } | null;
  items: CalculatedCartItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
}

export interface SearchPosItemsFilters {
  search?: string;
  type?: PosSearchType;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface ValidateCartPayload {
  customerId?: string;
  items: Array<{
    itemType: PosItemType;
    itemId: string;
    quantity: number;
    discountAmount: number;
  }>;
}

export function searchPosItems(filters: SearchPosItemsFilters = {}) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.type) query.set('type', filters.type);
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiRequest<PosSearchResponse>(`/pos/search-items${suffix}`);
}

export function validateCart(payload: ValidateCartPayload) {
  return apiRequest<CartValidationResponse>('/pos/validate-cart', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export { PosItemType, PosSearchType };
