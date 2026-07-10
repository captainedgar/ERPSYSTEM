'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { currency } from '@/components/sales-manager';
import {
  InternalDocumentStatus,
  InternalDocumentType,
  listInternalDocuments,
  type InternalDocument,
} from '@/lib/internal-documents';

const limit = 20;

export function InternalDocumentsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<InternalDocument[]>([]);
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = [
    'OWNER',
    'ADMIN',
    'CASHIER',
    'SELLER',
    'ACCOUNTING',
  ].includes(user?.role.code ?? '');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    void loadDocuments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, user]);

  async function loadDocuments(nextPage = 1) {
    setLoading(true);
    setError('');
    try {
      const response = await listInternalDocuments({
        search: search.trim() || undefined,
        documentType: documentType
          ? (documentType as InternalDocumentType)
          : undefined,
        status: status ? (status as InternalDocumentStatus) : undefined,
        saleId: searchParams.get('saleId') ?? undefined,
        page: nextPage,
        limit,
      });
      setItems(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar los documentos',
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (canView && loading && !items.length && !error)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando documentos...
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Redirigiendo al acceso...
      </main>
    );
  }
  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        No tienes permiso para consultar documentos internos.
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Documentos internos
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Recibos y facturas no fiscales
            </h1>
            <p className="mt-2 text-slate-500">
              Documentacion interna de ventas sin comprobante fiscal.
            </p>
          </div>
          <Link className="text-sm text-slate-600" href="/dashboard">
            Volver al panel
          </Link>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_200px_180px_auto]"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void loadDocuments(1);
            }}
          >
            <input
              aria-label="Buscar documentos"
              placeholder="Numero, venta, cliente o documento..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Tipo de documento"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              <option value="">Todos los tipos</option>
              <option value={InternalDocumentType.RECEIPT}>Recibo</option>
              <option value={InternalDocumentType.INTERNAL_INVOICE}>
                Factura interna
              </option>
            </select>
            <select
              aria-label="Estado"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value={InternalDocumentStatus.ISSUED}>Emitidos</option>
              <option value={InternalDocumentStatus.VOIDED}>Anulados</option>
            </select>
            <Button disabled={loading} type="submit" variant="secondary">
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>

          {error && (
            <div
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {!loading && !items.length ? (
              <p className="py-10 text-center text-slate-500">
                No hay documentos para estos filtros.
              </p>
            ) : (
              items.map((document) => (
                <DocumentCard document={document} key={document.id} />
              ))
            )}
          </div>

          {!loading && total > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
              <span>
                Pagina {page} de {Math.max(1, Math.ceil(total / limit))} ·{' '}
                {total} documentos
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => void loadDocuments(page - 1)}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
                <Button
                  disabled={page * limit >= total}
                  onClick={() => void loadDocuments(page + 1)}
                  type="button"
                  variant="secondary"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DocumentCard({ document }: { document: InternalDocument }) {
  return (
    <Link
      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 sm:grid-cols-[1fr_auto] sm:items-center"
      href={`/internal-documents/${document.id}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{document.documentNumber}</h2>
          <Status status={document.status} />
          <TypeLabel type={document.documentType} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {document.customer?.name ?? 'Consumidor final'} · Venta{' '}
          {document.sale.saleNumber} ·{' '}
          {new Date(document.createdAt).toLocaleString('es-DO')}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-lg font-semibold">
          {currency(Number(document.total))}
        </p>
        <p className="text-xs text-slate-500">{document.createdBy.name}</p>
      </div>
    </Link>
  );
}

export function Status({ status }: { status: InternalDocumentStatus }) {
  const styles =
    status === InternalDocumentStatus.ISSUED
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border border-red-200 bg-red-50 text-red-700';
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${styles}`}>
      {status === InternalDocumentStatus.ISSUED ? 'Emitido' : 'Anulado'}
    </span>
  );
}

export function TypeLabel({ type }: { type: InternalDocumentType }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700">
      {type === InternalDocumentType.RECEIPT ? 'Recibo' : 'Factura interna'}
    </span>
  );
}
