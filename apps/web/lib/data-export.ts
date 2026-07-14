import {
  API_URL,
  ApiError,
  getResponseMessage,
  getStoredAccessToken,
  getStoredActiveBranchId,
  parseJsonSafe,
} from './api';

export type ExportFormat = 'xlsx' | 'csv';
export type ExportScope = 'active_branch' | 'all_branches';

export interface DataExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  from?: string;
  to?: string;
}

export type DataExportKind =
  | 'products'
  | 'inventory'
  | 'customers'
  | 'sales'
  | 'sales/items'
  | 'cash'
  | 'inventory-movements'
  | 'inventory-transfers'
  | 'internal-documents'
  | 'reports/overview'
  | 'backup';

export async function downloadDataExport(
  kind: DataExportKind,
  options: DataExportOptions,
) {
  const params = new URLSearchParams();
  params.set('format', options.format);
  params.set('scope', options.scope);
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);

  const headers = new Headers();
  const token = getStoredAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const branchId = getStoredActiveBranchId();
  if (branchId) headers.set('X-Branch-Id', branchId);

  const response = await fetch(`${API_URL}/data-export/${kind}?${params}`, {
    headers,
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    const data = contentType.includes('application/json')
      ? await parseJsonSafe(response)
      : null;
    throw new ApiError(
      getResponseMessage(data) ?? 'No se pudo generar la exportacion.',
      response.status,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filenameFromDisposition(
    response.headers.get('content-disposition'),
    fallbackFilename(kind, options.format),
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(value: string | null, fallback: string) {
  const match = value?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

function fallbackFilename(kind: DataExportKind, format: ExportFormat) {
  const date = new Date().toISOString().slice(0, 10);
  return `comercia_${kind.replace(/\//g, '_')}_${date}.${format}`;
}
