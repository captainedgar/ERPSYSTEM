import { apiRequest } from './api';
import type { Product } from './catalog';

export type ProductCompatibilityGroupStatus = 'ACTIVE' | 'INACTIVE';
export type ProductAlternativeCodeType =
  'OEM' | 'MANUFACTURER' | 'REPLACEMENT' | 'OLD_CODE' | 'BARCODE' | 'OTHER';
export type ProductSubstituteType =
  'EQUIVALENT' | 'SUBSTITUTE' | 'UPGRADE' | 'DOWNGRADE' | 'RELATED';

export interface ProductCompatibilityGroup {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  status: ProductCompatibilityGroupStatus;
  products?: Array<{ id: string; productId: string; product: ProductSummary }>;
}

export interface ProductSummary {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string | number;
  taxRate: string | number;
  stock: string | number;
  trackInventory: boolean;
  allowDiscount: boolean;
  brand: { id: string; name: string } | null;
}

export interface ProductAlternative {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string | number;
  taxRate: string | number;
  stock: string | number;
  trackInventory: boolean;
  allowDiscount: boolean;
  brand: { id: string; name: string } | null;
  reason: string;
  relationType: string;
}

export interface ProductAlternativeCode {
  id: string;
  productId: string;
  code: string;
  type: ProductAlternativeCodeType;
}

export interface ProductSubstitute {
  id: string;
  productId: string;
  substituteProductId: string;
  type: ProductSubstituteType;
  notes?: string | null;
  isBidirectional: boolean;
  priority: number;
  product: ProductSummary;
  substituteProduct: ProductSummary;
}

export interface ProductCompatibilityResponse {
  groups: Array<{ id: string; group: ProductCompatibilityGroup }>;
  alternativeCodes: ProductAlternativeCode[];
  substitutes: ProductSubstitute[];
  alternatives: ProductAlternative[];
}

export interface ProductAlternativesResponse {
  requestedProduct: ProductSummary | null;
  alternatives: ProductAlternative[];
}

export function listCompatibilityGroups(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<ProductCompatibilityGroup[]>(
    `/product-compatibility/groups${query}`,
  );
}

export function createCompatibilityGroup(payload: {
  name: string;
  code: string;
  description?: string;
}) {
  return apiRequest<ProductCompatibilityGroup>(
    '/product-compatibility/groups',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function addProductToCompatibilityGroup(
  groupId: string,
  productId: string,
) {
  return apiRequest(`/product-compatibility/groups/${groupId}/products`, {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

export function removeProductFromCompatibilityGroup(
  groupId: string,
  productId: string,
) {
  return apiRequest(
    `/product-compatibility/groups/${groupId}/products/${productId}`,
    { method: 'DELETE' },
  );
}

export function getProductCompatibility(productId: string) {
  return apiRequest<ProductCompatibilityResponse>(
    `/products/${productId}/compatibility`,
  );
}

export function addAlternativeCode(
  productId: string,
  payload: { code: string; type?: ProductAlternativeCodeType },
) {
  return apiRequest<ProductAlternativeCode>(
    `/products/${productId}/alternative-codes`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export function removeAlternativeCode(productId: string, codeId: string) {
  return apiRequest(`/products/${productId}/alternative-codes/${codeId}`, {
    method: 'DELETE',
  });
}

export function addSubstitute(
  productId: string,
  payload: {
    substituteProductId: string;
    type?: ProductSubstituteType;
    isBidirectional?: boolean;
    priority?: number;
    notes?: string;
  },
) {
  return apiRequest<ProductSubstitute>(`/products/${productId}/substitutes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeSubstitute(productId: string, substituteId: string) {
  return apiRequest(`/products/${productId}/substitutes/${substituteId}`, {
    method: 'DELETE',
  });
}

export function getPosAlternatives(productId: string) {
  return apiRequest<ProductAlternativesResponse>(
    `/pos/items/${productId}/alternatives`,
  );
}

export function getPosAlternativesByCode(query: string) {
  return apiRequest<ProductAlternativesResponse>(
    `/pos/alternatives?query=${encodeURIComponent(query)}`,
  );
}

export function productLabel(product: Pick<Product, 'name' | 'sku'>) {
  return product.sku ? `${product.name} / ${product.sku}` : product.name;
}
