'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { currency } from '@/components/sales-manager';
import {
  ElectronicInvoiceStatus,
  listElectronicInvoices,
  type ElectronicInvoice,
} from '@/lib/fiscal';

const limit = 20;

export function FiscalInvoicesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<ElectronicInvoice[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = ['OWNER', 'ADMIN', 'ACCOUNTING', 'CASHIER'].includes(
    user?.role.code ?? '',
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    void loadInvoices(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, user]);

  async function loadInvoices(nextPage = 1) {
    setLoading(true);
    setError('');
    try {
      const response = await listElectronicInvoices({
        search: search.trim() || undefined,
        status: status ? (status as ElectronicInvoiceStatus) : undefined,
        saleId: searchParams.get('saleId') ?? undefined,
        internalDocumentId: searchParams.get('internalDocumentId') ?? undefined,
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
          : 'No se pudieron cargar documentos fiscales',
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (canView && loading && !items.length && !error)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando fiscal...
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Redirigiendo...
      </main>
    );
  }
  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        No tienes permiso para consultar documentos fiscales.
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Fiscal mock
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Documentos fiscales internos
            </h1>
            <p className="mt-2 text-slate-400">
              Seguimiento sandbox sin emision e-CF productiva.
            </p>
          </div>
          <Link className="text-sm text-slate-300" href="/fiscal/settings">
            Configuracion fiscal
          </Link>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_220px_auto]"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void loadInvoices(1);
            }}
          >
            <input
              aria-label="Buscar fiscal"
              placeholder="Numero, tracking, venta, documento o cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Estado fiscal"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.values(ElectronicInvoiceStatus).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button disabled={loading} type="submit" variant="secondary">
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {!loading && !items.length ? (
              <p className="py-10 text-center text-slate-500">
                No hay documentos fiscales para estos filtros.
              </p>
            ) : (
              items.map((invoice) => (
                <InvoiceCard invoice={invoice} key={invoice.id} />
              ))
            )}
          </div>

          {!loading && total > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
              <span>
                Pagina {page} de {Math.max(1, Math.ceil(total / limit))} ·{' '}
                {total} documentos
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => void loadInvoices(page - 1)}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
                <Button
                  disabled={page * limit >= total}
                  onClick={() => void loadInvoices(page + 1)}
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

export function FiscalStatus({ status }: { status: ElectronicInvoiceStatus }) {
  const styles = {
    DRAFT: 'bg-slate-800 text-slate-200',
    PENDING_PROVIDER: 'bg-amber-950 text-amber-200',
    SENT: 'bg-sky-950 text-sky-200',
    ACCEPTED: 'bg-emerald-950 text-emerald-200',
    REJECTED: 'bg-rose-950 text-rose-200',
    FAILED: 'bg-red-950 text-red-200',
    CANCELLED: 'bg-slate-800 text-slate-400',
  }[status];
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${styles}`}>{status}</span>
  );
}

function InvoiceCard({ invoice }: { invoice: ElectronicInvoice }) {
  const total = totalFromPayload(invoice.payload);
  return (
    <Link
      className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-600 sm:grid-cols-[1fr_auto] sm:items-center"
      href={`/fiscal/electronic-invoices/${invoice.id}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            {invoice.fiscalNumber ?? invoice.providerTrackId ?? invoice.id}
          </h2>
          <FiscalStatus status={invoice.status} />
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {invoice.customer?.name ?? 'Consumidor final'} ·{' '}
          {invoice.sale ? `Venta ${invoice.sale.saleNumber}` : ''}
          {invoice.internalDocument
            ? ` Documento ${invoice.internalDocument.documentNumber}`
            : ''}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-lg font-semibold">{currency(total)}</p>
        <p className="text-xs text-slate-400">{invoice.documentType}</p>
      </div>
    </Link>
  );
}

function totalFromPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'totals' in payload &&
    payload.totals &&
    typeof payload.totals === 'object' &&
    'total' in payload.totals
  ) {
    return Number(payload.totals.total);
  }
  return 0;
}
