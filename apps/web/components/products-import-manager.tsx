'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  commitProductImport,
  downloadProductImportTemplate,
  previewProductImport,
  type ProductImportCommitResult,
  type ProductImportPreview,
  type ProductImportPreviewRow,
} from '@/lib/products-import';

export function ProductsImportManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [result, setResult] = useState<ProductImportCommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  async function downloadTemplate() {
    setError('');
    try {
      const blob = await downloadProductImportTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'plantilla-productos-comercia.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo descargar la plantilla',
      );
    }
  }

  async function previewFile() {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setPreview(await previewProductImport(file, createMissing));
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo previsualizar el archivo',
      );
    } finally {
      setLoading(false);
    }
  }

  async function commitFile() {
    if (!file || !preview || preview.invalidRows > 0) return;
    setLoading(true);
    setError('');
    try {
      setResult(await commitProductImport(file, createMissing));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo confirmar la importación',
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              Catálogo
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Importar productos
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Carga productos desde Excel, valida duplicados y confirma solo
              cuando la previsualización esté limpia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void downloadTemplate()} type="button">
              Descargar plantilla
            </Button>
            <Link
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
              href="/catalog/products"
            >
              Volver a productos
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="grid gap-4">
            <StepCard number="1" title="Subir archivo Excel">
              <input
                accept=".xlsx"
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
                type="file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
              />
              <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input
                  checked={createMissing}
                  type="checkbox"
                  onChange={() => setCreateMissing((current) => !current)}
                />
                Crear categorías, marcas y unidades automáticamente.
              </label>
              <Button
                className="mt-4 w-full"
                disabled={!file || loading}
                type="button"
                onClick={() => void previewFile()}
              >
                {loading ? 'Procesando...' : 'Previsualizar'}
              </Button>
            </StepCard>

            <StepCard number="4" title="Confirmar importación">
              <p className="text-sm text-slate-600">
                La importación se bloquea si hay filas con errores críticos.
              </p>
              <Button
                className="mt-4 w-full"
                disabled={!preview || preview.invalidRows > 0 || loading}
                type="button"
                onClick={() => void commitFile()}
              >
                Confirmar importación
              </Button>
            </StepCard>
          </div>

          <div className="grid gap-4">
            {preview && <PreviewSummary preview={preview} />}
            {result && <ResultSummary result={result} />}
            <PreviewTable rows={preview?.previewRows ?? []} />
          </div>
        </section>
      </div>
    </main>
  );
}

function StepCard({
  children,
  number,
  title,
}: {
  children: ReactNode;
  number: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          {number}
        </span>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PreviewSummary({ preview }: { preview: ProductImportPreview }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">
        Previsualización
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Filas" value={preview.totalRows} />
        <Metric label="Válidas" value={preview.validRows} />
        <Metric label="Con errores" value={preview.invalidRows} />
      </div>
      <RelationPreview
        title="Categorías nuevas"
        values={preview.createdCategoriesPreview}
      />
      <RelationPreview
        title="Marcas nuevas"
        values={preview.createdBrandsPreview}
      />
      <RelationPreview
        title="Unidades nuevas"
        values={preview.createdUnitsPreview}
      />
    </section>
  );
}

function ResultSummary({ result }: { result: ProductImportCommitResult }) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-emerald-950">Resultado</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Productos creados" value={result.productsCreated} />
        <Metric label="Filas omitidas" value={result.rowsSkipped} />
        <Metric
          label="Movimientos stock"
          value={result.inventoryMovementsCreated}
        />
      </div>
    </section>
  );
}

function PreviewTable({ rows }: { rows: ProductImportPreviewRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">
          Filas del archivo
        </h2>
        <span className="text-sm text-slate-500">{rows.length} filas</span>
      </div>
      {!rows.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Sube un archivo .xlsx para ver la previsualización.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                {[
                  'Fila',
                  'Nombre',
                  'SKU',
                  'Código de barras',
                  'Categoría',
                  'Marca',
                  'Unidad',
                  'Precio',
                  'Stock inicial',
                  'Estado',
                  'Errores',
                  'Advertencias',
                ].map((column) => (
                  <th
                    className="border-b border-slate-200 py-3 pr-4"
                    key={column}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td className="py-3 pr-4 text-slate-700">{row.rowNumber}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900">
                    {row.name || 'N/D'}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {row.sku ?? 'N/D'}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {row.barcode ?? 'N/D'}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {row.category ?? 'N/D'}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {row.brand ?? 'N/D'}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {row.unit ?? 'N/D'}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    RD$ {row.price.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{row.stock}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="max-w-64 py-3 pr-4 text-red-700">
                    {row.errors.join(', ') || 'N/D'}
                  </td>
                  <td className="max-w-64 py-3 pr-4 text-amber-700">
                    {row.warnings.join(', ') || 'N/D'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function RelationPreview({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  if (!values.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
            key={value}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ProductImportPreviewRow['status'];
}) {
  const styles = {
    VALID: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    ERROR: 'border-red-200 bg-red-50 text-red-700',
  };
  const labels = {
    VALID: 'Válida',
    WARNING: 'Advertencias',
    ERROR: 'Errores',
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
