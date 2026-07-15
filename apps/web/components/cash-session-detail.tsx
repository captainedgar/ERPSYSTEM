'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { currency } from '@/components/cash-manager';
import { Status } from '@/components/cash-sessions-manager';
import { CashMovementType, getCashSession, type CashSession } from '@/lib/cash';
import { hasPermission } from '@/lib/permissions';

const movementLabels: Record<CashMovementType, string> = {
  OPENING: 'Apertura',
  SALE_CASH_IN: 'Venta en efectivo',
  MANUAL_IN: 'Entrada manual',
  MANUAL_OUT: 'Salida manual',
  SALE_CANCELLED_OUT: 'Anulación de venta',
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de salida',
};

export function CashSessionDetail({
  cashSessionId,
}: {
  cashSessionId: string;
}) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'cash.view_sessions');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await getCashSession(cashSessionId);
        if (!cancelled) setSession(response);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la caja',
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
  }, [canView, cashSessionId, user]);

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando detalle…
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
        No tienes permiso para consultar cajas.
      </main>
    );
  }
  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center text-center">
        <div>
          <p className="text-rose-300">{error || 'Caja no encontrada'}</p>
          <Link
            className="mt-4 inline-block text-blue-600"
            href="/cash/sessions"
          >
            Volver al historial
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Detalle de caja
            </p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-3xl font-semibold">{session.branch.name}</h1>
              <Status status={session.status} />
            </div>
            <p className="mt-2 text-slate-500">
              {session.openedBy.name} ·{' '}
              {new Date(session.openedAt).toLocaleString('es-DO')}
            </p>
          </div>
          <Link className="text-slate-600" href="/cash/sessions">
            Volver al historial
          </Link>
        </header>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Value label="Apertura" value={session.openingAmount} />
          <Value label="Ventas efectivo" value={session.salesCashTotal} />
          <Value label="Entradas manuales" value={session.manualInTotal} />
          <Value label="Salidas manuales" value={session.manualOutTotal} />
          <Value label="Efectivo esperado" value={session.expectedCashAmount} />
          <Value label="Efectivo contado" value={session.countedCashAmount} />
          <Value label="Diferencia" value={session.differenceAmount} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">Cierre</dt>
            <dd className="mt-2 font-medium">
              {session.closedAt
                ? new Date(session.closedAt).toLocaleString('es-DO')
                : 'Pendiente'}
            </dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Movimientos</h2>
            <div className="mt-4 grid gap-3">
              {!session.movements?.length ? (
                <p className="py-8 text-center text-slate-500">
                  No hay movimientos.
                </p>
              ) : (
                session.movements.map((movement) => (
                  <article
                    className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto]"
                    key={movement.id}
                  >
                    <div>
                      <p className="font-medium">
                        {movementLabels[movement.type]}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {movement.reason} · {movement.createdBy.name}
                      </p>
                      {movement.sale && (
                        <Link
                          className="mt-1 inline-block text-xs text-blue-600"
                          href={`/sales/${movement.sale.id}`}
                        >
                          {movement.sale.saleNumber}
                        </Link>
                      )}
                    </div>
                    <div className="sm:text-right">
                      <p className="font-semibold">
                        {movementSign(movement.type)}
                        {currency(Number(movement.amount))}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(movement.createdAt).toLocaleString('es-DO')}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Ventas relacionadas</h2>
            <div className="mt-4 grid gap-3">
              {!session.sales?.length ? (
                <p className="text-sm text-slate-500">
                  No hay ventas asociadas.
                </p>
              ) : (
                session.sales.map((sale) => (
                  <Link
                    className="rounded-xl bg-slate-50 p-3"
                    href={`/sales/${sale.id}`}
                    key={sale.id}
                  >
                    <p className="font-medium">{sale.saleNumber}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {currency(Number(sale.total))}
                    </p>
                  </Link>
                ))
              )}
            </div>
            {session.notes && (
              <>
                <h2 className="mt-6 text-lg font-semibold">Notas</h2>
                <p className="mt-2 text-sm text-slate-500">{session.notes}</p>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Value({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-2 font-semibold">
        {value === null ? '—' : currency(Number(value))}
      </dd>
    </div>
  );
}

function movementSign(type: CashMovementType) {
  return [
    CashMovementType.MANUAL_OUT,
    CashMovementType.SALE_CANCELLED_OUT,
    CashMovementType.ADJUSTMENT_OUT,
  ].includes(type)
    ? '−'
    : '+';
}
