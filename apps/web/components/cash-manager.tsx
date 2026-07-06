'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  closeCashSession,
  createManualCashIn,
  createManualCashOut,
  getCurrentCashSession,
  openCashSession,
  type CashSession,
} from '@/lib/cash';

export function CashManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [lastClosed, setLastClosed] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const role = user?.role.code ?? '';
  const canView = [
    'OWNER',
    'ADMIN',
    'CASHIER',
    'SELLER',
    'ACCOUNTING',
  ].includes(role);
  const canOperate = ['OWNER', 'ADMIN', 'CASHIER'].includes(role);
  const canViewHistory = ['OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTING'].includes(
    role,
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const current = await getCurrentCashSession();
        if (!cancelled) setSession(current);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo consultar la caja',
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

  async function submitOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.branch) return;
    await runAction(async () => {
      const opened = await openCashSession({
        branchId: user.branch!.id,
        openingAmount: Number(openingAmount),
        notes: openingNotes.trim() || undefined,
      });
      setSession(opened);
      setLastClosed(null);
      setOpeningNotes('');
    });
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    await runAction(async () => {
      const payload = {
        cashSessionId: session.id,
        amount: Number(movementAmount),
        reason: movementReason,
      };
      const updated =
        movementType === 'in'
          ? await createManualCashIn(payload)
          : await createManualCashOut(payload);
      setSession(updated);
      setMovementAmount('');
      setMovementReason('');
    });
  }

  async function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    await runAction(async () => {
      const closed = await closeCashSession({
        cashSessionId: session.id,
        countedCashAmount: Number(countedAmount),
        notes: closingNotes.trim() || undefined,
      });
      setLastClosed(closed);
      setSession(null);
      setCountedAmount('');
      setClosingNotes('');
    });
  }

  async function runAction(action: () => Promise<void>) {
    setSubmitting(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo actualizar caja',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando caja…
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
      <main className="grid min-h-screen place-items-center text-center">
        <div>
          <p>No tienes permiso para consultar caja.</p>
          <Link
            className="mt-4 inline-block text-emerald-400"
            href="/dashboard"
          >
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Caja · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Caja actual</h1>
            <p className="mt-2 text-slate-400">
              Control diario de efectivo para{' '}
              {user.branch?.name ?? 'tu sucursal'}.
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            {canViewHistory && (
              <Link className="text-emerald-400" href="/cash/sessions">
                Historial
              </Link>
            )}
            <Link className="text-slate-300" href="/dashboard">
              Volver al panel
            </Link>
          </div>
        </header>

        {error && (
          <div
            className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {lastClosed && (
          <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 text-emerald-200">
            Caja cerrada. Diferencia:{' '}
            {currency(Number(lastClosed.differenceAmount))}.{' '}
            <Link
              className="font-semibold underline"
              href={`/cash/sessions/${lastClosed.id}`}
            >
              Ver cierre
            </Link>
          </div>
        )}

        {!session ? (
          <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-xl font-semibold">
              No tienes una caja abierta
            </h2>
            <p className="mt-2 text-slate-400">
              Abre una caja para registrar ventas en efectivo y movimientos.
            </p>
            {canOperate && user.branch && (
              <form
                className="mt-6 grid max-w-xl gap-4"
                onSubmit={(event) => void submitOpen(event)}
              >
                <label>
                  Monto inicial
                  <input
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={openingAmount}
                    onChange={(event) => setOpeningAmount(event.target.value)}
                  />
                </label>
                <label>
                  Notas (opcional)
                  <textarea
                    rows={3}
                    value={openingNotes}
                    onChange={(event) => setOpeningNotes(event.target.value)}
                  />
                </label>
                <Button disabled={submitting} type="submit">
                  {submitting ? 'Abriendo…' : 'Abrir caja'}
                </Button>
              </form>
            )}
          </section>
        ) : (
          <>
            <CashSummary session={session} />
            {canOperate && (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
                  <h2 className="text-xl font-semibold">Movimiento manual</h2>
                  <form
                    className="mt-4 grid gap-4"
                    onSubmit={(event) => void submitMovement(event)}
                  >
                    <label>
                      Tipo
                      <select
                        value={movementType}
                        onChange={(event) =>
                          setMovementType(event.target.value as 'in' | 'out')
                        }
                      >
                        <option value="in">Entrada de efectivo</option>
                        <option value="out">Salida / gasto</option>
                      </select>
                    </label>
                    <label>
                      Monto
                      <input
                        min="0.01"
                        required
                        step="0.01"
                        type="number"
                        value={movementAmount}
                        onChange={(event) =>
                          setMovementAmount(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Motivo
                      <input
                        minLength={3}
                        required
                        value={movementReason}
                        onChange={(event) =>
                          setMovementReason(event.target.value)
                        }
                      />
                    </label>
                    <Button
                      disabled={submitting}
                      type="submit"
                      variant={movementType === 'out' ? 'secondary' : 'primary'}
                    >
                      Registrar {movementType === 'in' ? 'entrada' : 'salida'}
                    </Button>
                  </form>
                </section>

                <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
                  <h2 className="text-xl font-semibold">Cerrar caja</h2>
                  <form
                    className="mt-4 grid gap-4"
                    onSubmit={(event) => void submitClose(event)}
                  >
                    <label>
                      Efectivo contado
                      <input
                        min="0"
                        required
                        step="0.01"
                        type="number"
                        value={countedAmount}
                        onChange={(event) =>
                          setCountedAmount(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Notas del cierre (opcional)
                      <textarea
                        rows={3}
                        value={closingNotes}
                        onChange={(event) =>
                          setClosingNotes(event.target.value)
                        }
                      />
                    </label>
                    <Button
                      disabled={submitting}
                      type="submit"
                      variant="secondary"
                    >
                      {submitting ? 'Cerrando…' : 'Cerrar caja'}
                    </Button>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function CashSummary({ session }: { session: CashSession }) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Caja abierta</h2>
          <p className="mt-1 text-sm text-slate-400">
            Desde {new Date(session.openedAt).toLocaleString('es-DO')} ·{' '}
            {session.openedBy.name}
          </p>
        </div>
        <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
          ABIERTA
        </span>
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryValue label="Apertura" value={session.openingAmount} />
        <SummaryValue label="Ventas efectivo" value={session.salesCashTotal} />
        <SummaryValue label="Entradas" value={session.manualInTotal} />
        <SummaryValue label="Salidas" value={session.manualOutTotal} />
        <SummaryValue
          emphasized
          label="Efectivo esperado"
          value={session.expectedCashAmount}
        />
      </dl>
    </section>
  );
}

function SummaryValue({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string | number;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${emphasized ? 'bg-emerald-950/50' : 'bg-slate-900'}`}
    >
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-2 font-semibold">{currency(Number(value))}</dd>
    </div>
  );
}

export function currency(value: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(value);
}
