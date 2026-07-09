'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { FiscalStatus } from '@/components/fiscal-invoices-manager';
import { currency } from '@/components/sales-manager';
import {
  checkElectronicInvoiceStatus,
  ElectronicInvoiceStatus,
  getElectronicInvoice,
  getElectronicInvoiceErrors,
  getElectronicInvoiceEvents,
  retryElectronicInvoice,
  sendElectronicInvoice,
  type ElectronicInvoice,
  type ElectronicInvoiceEvent,
  type FiscalError,
  type MockFiscalOutcome,
} from '@/lib/fiscal';

export function FiscalInvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [invoice, setInvoice] = useState<ElectronicInvoice | null>(null);
  const [events, setEvents] = useState<ElectronicInvoiceEvent[]>([]);
  const [errors, setErrors] = useState<FiscalError[]>([]);
  const [mockOutcome, setMockOutcome] = useState<MockFiscalOutcome>('ACCEPTED');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canView = ['OWNER', 'ADMIN', 'ACCOUNTING', 'CASHIER'].includes(
    user?.role.code ?? '',
  );
  const canSend = ['OWNER', 'ADMIN', 'ACCOUNTING'].includes(
    user?.role.code ?? '',
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  async function loadInvoiceDetails() {
    setLoading(true);
    setError('');
    try {
      const [nextInvoice, nextEvents, nextErrors] = await Promise.all([
        getElectronicInvoice(id),
        canSend ? getElectronicInvoiceEvents(id) : Promise.resolve([]),
        canSend ? getElectronicInvoiceErrors(id) : Promise.resolve([]),
      ]);
      setInvoice(nextInvoice);
      setEvents(nextEvents);
      setErrors(nextErrors);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar el documento fiscal',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user || !canView) return;
    void Promise.resolve().then(() => loadInvoiceDetails());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, id, user]);

  async function run(action: 'send' | 'retry' | 'status') {
    if (!invoice) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'send') {
        setInvoice(await sendElectronicInvoice(invoice.id, mockOutcome));
      }
      if (action === 'retry') {
        setInvoice(await retryElectronicInvoice(invoice.id, mockOutcome));
      }
      if (action === 'status') {
        setInvoice(await checkElectronicInvoiceStatus(invoice.id));
      }
      const [nextEvents, nextErrors] = await Promise.all([
        canSend ? getElectronicInvoiceEvents(invoice.id) : Promise.resolve([]),
        canSend ? getElectronicInvoiceErrors(invoice.id) : Promise.resolve([]),
      ]);
      setEvents(nextEvents);
      setErrors(nextErrors);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo ejecutar accion',
      );
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || (canView && loading)) {
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
  if (!invoice) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <p className="text-rose-300">
            {error || 'Documento fiscal no encontrado'}
          </p>
          <Link
            className="mt-4 inline-block text-emerald-400"
            href="/fiscal/electronic-invoices"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  const canRetry = [
    ElectronicInvoiceStatus.FAILED,
    ElectronicInvoiceStatus.REJECTED,
  ].includes(invoice.status);

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Documento fiscal mock
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">
                {invoice.fiscalNumber ?? invoice.providerTrackId ?? invoice.id}
              </h1>
              <FiscalStatus status={invoice.status} />
            </div>
            <p className="mt-2 text-slate-400">
              {invoice.documentType} ·{' '}
              {new Date(invoice.createdAt).toLocaleString('es-DO')}
            </p>
          </div>
          <Link
            className="text-sm text-slate-300"
            href="/fiscal/electronic-invoices"
          >
            Volver
          </Link>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="grid gap-6">
            <JsonPanel title="Payload interno" value={invoice.payload} />
            <JsonPanel title="Respuesta mock" value={invoice.response} />
            {canSend && (
              <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
                <h2 className="text-xl font-semibold">Eventos</h2>
                <div className="mt-4 grid gap-3">
                  {events.map((event) => (
                    <article
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                      key={event.id}
                    >
                      <p className="font-medium">{event.eventType}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {event.message}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(event.createdAt).toLocaleString('es-DO')}
                      </p>
                    </article>
                  ))}
                  {!events.length && (
                    <p className="text-slate-500">Sin eventos.</p>
                  )}
                </div>
              </section>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-xl font-semibold">Resumen</h2>
            <p className="mt-4 text-sm text-slate-400">Cliente</p>
            <p>{invoice.customer?.name ?? 'Consumidor final'}</p>
            <dl className="mt-5 grid gap-2 border-t border-slate-800 pt-4 text-sm">
              <Row label="Total" value={totalFromPayload(invoice.payload)} />
              <div className="flex justify-between text-slate-300">
                <dt>Tracking</dt>
                <dd>{invoice.providerTrackId ?? 'Pendiente'}</dd>
              </div>
            </dl>

            {canSend && (
              <div className="mt-5 border-t border-slate-800 pt-5">
                <label>
                  Resultado mock
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                    value={mockOutcome}
                    onChange={(event) =>
                      setMockOutcome(event.target.value as MockFiscalOutcome)
                    }
                  >
                    <option value="ACCEPTED">Accepted</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="FAILED">Failed</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </label>
                <div className="mt-4 grid gap-2">
                  <Button
                    disabled={
                      busy || invoice.status !== ElectronicInvoiceStatus.DRAFT
                    }
                    onClick={() => void run('send')}
                    type="button"
                  >
                    {busy ? 'Procesando...' : 'Enviar mock'}
                  </Button>
                  <Button
                    disabled={busy || !canRetry}
                    onClick={() => void run('retry')}
                    type="button"
                    variant="secondary"
                  >
                    Reintentar
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => void run('status')}
                    type="button"
                    variant="secondary"
                  >
                    Consultar estado
                  </Button>
                </div>
              </div>
            )}

            {canSend && (
              <div className="mt-5 border-t border-slate-800 pt-5">
                <h3 className="font-semibold">Errores</h3>
                <div className="mt-3 grid gap-2">
                  {errors.map((item) => (
                    <div
                      className="rounded-2xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-100"
                      key={item.id}
                    >
                      <p className="font-medium">{item.code}</p>
                      <p>{item.message}</p>
                    </div>
                  ))}
                  {!errors.length && (
                    <p className="text-sm text-slate-500">Sin errores.</p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-300">
      <dt>{label}</dt>
      <dd>{currency(value)}</dd>
    </div>
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
