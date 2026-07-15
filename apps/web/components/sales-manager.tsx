'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { listSales, SaleStatus, type Sale } from '@/lib/sales';
import { hasPermission } from '@/lib/permissions';

const limit = 20;

export function SalesManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = hasPermission(user, 'sales.view');
  const canCreate = hasPermission(user, 'sales.create');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await listSales({ page: 1, limit });
        if (cancelled) return;
        setItems(response.items);
        setTotal(response.total);
        setPage(response.page);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudieron cargar las ventas',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canView, user]);

  async function loadSales(nextPage = 1) {
    setLoading(true);
    setError('');
    try {
      const response = await listSales({
        search: search.trim() || undefined,
        status: status ? (status as SaleStatus) : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
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
          : 'No se pudieron cargar las ventas',
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (canView && loading && !items.length && !error)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando ventas…
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Redirigiendo al acceso…
      </main>
    );
  }
  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Acceso no disponible</h1>
          <p className="mt-2 text-slate-500">
            Tu rol no puede consultar ventas.
          </p>
          <Link className="mt-5 inline-block text-blue-600" href="/dashboard">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Ventas · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Ventas internas</h1>
            <p className="mt-2 text-slate-500">
              Consulta ventas, pagos y balances sin documentación fiscal.
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            {canCreate && (
              <Link className="text-blue-600" href="/pos">
                Nueva venta
              </Link>
            )}
            <Link className="text-slate-600" href="/dashboard">
              Volver al panel
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_180px_160px_160px_auto]"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void loadSales(1);
            }}
          >
            <input
              aria-label="Buscar ventas"
              placeholder="Número, cliente o documento…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Estado de venta"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value={SaleStatus.COMPLETED}>Completadas</option>
              <option value={SaleStatus.CANCELLED}>Anuladas</option>
              <option value={SaleStatus.DRAFT}>Borradores</option>
            </select>
            <input
              aria-label="Fecha inicial"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <input
              aria-label="Fecha final"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <Button disabled={loading} type="submit" variant="secondary">
              {loading ? 'Buscando…' : 'Buscar'}
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
                No hay ventas para estos filtros.
              </p>
            ) : (
              items.map((sale) => <SaleCard key={sale.id} sale={sale} />)
            )}
          </div>

          {!loading && total > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
              <span>
                Página {page} de {Math.max(1, Math.ceil(total / limit))} ·{' '}
                {total} ventas
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => void loadSales(page - 1)}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
                <Button
                  disabled={page * limit >= total}
                  onClick={() => void loadSales(page + 1)}
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

function SaleCard({ sale }: { sale: Sale }) {
  return (
    <Link
      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 sm:grid-cols-[1fr_auto] sm:items-center"
      href={`/sales/${sale.id}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{sale.saleNumber}</h2>
          <Status status={sale.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {sale.customer?.name ?? 'Consumidor final'} ·{' '}
          {new Date(sale.createdAt).toLocaleString('es-DO')} ·{' '}
          {sale.createdBy.name}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-lg font-semibold">{currency(Number(sale.total))}</p>
        <p className="text-xs text-slate-500">
          Pagado {currency(Number(sale.paidTotal))} · Balance{' '}
          {currency(Number(sale.balanceDue))}
        </p>
      </div>
    </Link>
  );
}

export function Status({ status }: { status: SaleStatus }) {
  const styles =
    status === SaleStatus.COMPLETED
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === SaleStatus.CANCELLED
        ? 'border border-red-200 bg-red-50 text-red-700'
        : 'bg-amber-950 text-amber-300';
  const label = {
    [SaleStatus.COMPLETED]: 'Completada',
    [SaleStatus.CANCELLED]: 'Anulada',
    [SaleStatus.DRAFT]: 'Borrador',
  }[status];
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${styles}`}>{label}</span>
  );
}

export function currency(value: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(value);
}
