'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { currency } from '@/components/cash-manager';
import {
  CashSessionStatus,
  listCashSessions,
  type CashSession,
} from '@/lib/cash';

const limit = 20;

export function CashSessionsManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<CashSession[]>([]);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = ['OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTING'].includes(
    user?.role.code ?? '',
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await listCashSessions({ page: 1, limit });
        if (cancelled) return;
        setItems(response.items);
        setTotal(response.total);
        setPage(response.page);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar el historial',
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

  async function loadSessions(nextPage = 1) {
    setLoading(true);
    setError('');
    try {
      const response = await listCashSessions({
        status: status ? (status as CashSessionStatus) : undefined,
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
          : 'No se pudo cargar el historial',
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (canView && loading && !items.length && !error)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando historial…
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
      <main className="grid min-h-screen place-items-center">
        No tienes permiso para consultar el historial de caja.
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Caja · Historial
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Sesiones de caja</h1>
          </div>
          <Link className="text-slate-300" href="/cash">
            Volver a caja
          </Link>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <form
            className="grid gap-3 sm:grid-cols-[180px_180px_180px_auto]"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void loadSessions(1);
            }}
          >
            <select
              aria-label="Estado"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value={CashSessionStatus.OPEN}>Abiertas</option>
              <option value={CashSessionStatus.CLOSED}>Cerradas</option>
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
              {loading ? 'Buscando…' : 'Filtrar'}
            </Button>
          </form>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {!loading && !items.length ? (
              <p className="py-10 text-center text-slate-500">
                No hay sesiones para estos filtros.
              </p>
            ) : (
              items.map((session) => (
                <Link
                  className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-600 md:grid-cols-[1fr_auto] md:items-center"
                  href={`/cash/sessions/${session.id}`}
                  key={session.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{session.branch.name}</h2>
                      <Status status={session.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {session.openedBy.name} ·{' '}
                      {new Date(session.openedAt).toLocaleString('es-DO')}
                      {session.closedAt
                        ? ` → ${new Date(session.closedAt).toLocaleString('es-DO')}`
                        : ''}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="font-semibold">
                      Esperado {currency(Number(session.expectedCashAmount))}
                    </p>
                    {session.differenceAmount !== null && (
                      <p className="text-sm text-slate-400">
                        Diferencia {currency(Number(session.differenceAmount))}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {!loading && total > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-sm text-slate-400">
              <span>
                Página {page} de {Math.max(1, Math.ceil(total / limit))}
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => void loadSessions(page - 1)}
                  type="button"
                  variant="secondary"
                >
                  Anterior
                </Button>
                <Button
                  disabled={page * limit >= total}
                  onClick={() => void loadSessions(page + 1)}
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

export function Status({ status }: { status: CashSessionStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        status === CashSessionStatus.OPEN
          ? 'bg-emerald-950 text-emerald-300'
          : 'bg-slate-800 text-slate-300'
      }`}
    >
      {status === CashSessionStatus.OPEN ? 'ABIERTA' : 'CERRADA'}
    </span>
  );
}
