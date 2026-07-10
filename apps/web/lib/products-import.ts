import {
  API_URL,
  ApiError,
  getResponseMessage,
  getStoredAccessToken,
  getStoredActiveBranchId,
  parseJsonSafe,
} from './api';

export interface ProductImportPreviewRow {
  rowNumber: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  unit: string | null;
  price: number;
  stock: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  errors: string[];
  warnings: string[];
}

export interface ProductImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: string[];
  errors: string[];
  previewRows: ProductImportPreviewRow[];
  createdCategoriesPreview: string[];
  createdBrandsPreview: string[];
  createdUnitsPreview: string[];
}

export interface ProductImportCommitResult {
  productsCreated: number;
  rowsSkipped: number;
  inventoryMovementsCreated: number;
  createdProducts: Array<{ id: string; name: string }>;
  errors: string[];
  warnings: string[];
}

export async function downloadProductImportTemplate() {
  const response = await fetch(`${API_URL}/products/import/template`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await parseJsonSafe(response);
    throw new ApiError(
      getResponseMessage(data) ?? 'No se pudo descargar la plantilla',
      response.status,
    );
  }
  return response.blob();
}

export function previewProductImport(
  file: File,
  createMissingRelations: boolean,
) {
  return upload<ProductImportPreview>(
    '/products/import/preview',
    file,
    createMissingRelations,
  );
}

export function commitProductImport(
  file: File,
  createMissingRelations: boolean,
) {
  return upload<ProductImportCommitResult>(
    '/products/import/commit',
    file,
    createMissingRelations,
  );
}

async function upload<T>(
  path: string,
  file: File,
  createMissingRelations: boolean,
) {
  const body = new FormData();
  body.append('file', file);
  const query = `?createMissingRelations=${String(createMissingRelations)}`;
  const response = await fetch(`${API_URL}${path}${query}`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new ApiError(
      getResponseMessage(data) ?? 'No se pudo procesar el archivo',
      response.status,
    );
  }
  return data as T;
}

function authHeaders() {
  const headers = new Headers();
  const token = getStoredAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const activeBranchId = getStoredActiveBranchId();
  if (activeBranchId) headers.set('X-Branch-Id', activeBranchId);
  return headers;
}
