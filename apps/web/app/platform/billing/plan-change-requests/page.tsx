'use client';

import { Button } from '@comercia/ui';
import { useEffect, useMemo, useState } from 'react';

import {
  PlatformHeader,
  platformErrorClass,
  platformErrorMessage,
  platformPanelClass,
} from '@/components/platform-ui';
import { canManageBilling, usePlatformUser } from '@/components/platform-shell';
import {
  approvePlanChangeRequest,
  listPlanChangeRequests,
  rejectPlanChangeRequest,
  type PlatformPlanChangeRequest,
} from '@/lib/platform';

export default function PlanChangeRequestsPage() {
  const user = usePlatformUser();
  const [requests, setRequests] = useState<PlatformPlanChangeRequest[]>([]);
  const [selected, setSelected] = useState<PlatformPlanChangeRequest | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  async function refresh() {
    const next = await listPlanChangeRequests();
    setRequests(next);
    if (selected) {
      setSelected(next.find((item) => item.id === selected.id) ?? null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void listPlanChangeRequests()
      .then((next) => {
        if (!cancelled) setRequests(next);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            platformErrorMessage(
              'No se pudieron cargar las solicitudes.',
              reason,
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(
    () => requests.filter((request) => request.status === 'PENDING').length,
    [requests],
  );

  async function review(action: 'approve' | 'reject') {
    if (!selected) return;
    setReviewing(true);
    setError('');
    setMessage('');
    try {
      const response =
        action === 'approve'
          ? await approvePlanChangeRequest(selected.id, note || undefined)
          : await rejectPlanChangeRequest(selected.id, note || undefined);
      setMessage(response.message);
      setNote('');
      await refresh();
    } catch (reason) {
      setError(
        platformErrorMessage('No se pudo revisar la solicitud.', reason),
      );
    } finally {
      setReviewing(false);
    }
  }

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Solicitudes de cambio de plan" />
        <p className="mt-2 text-sm text-slate-600">
          {pending} solicitud(es) pendientes. Aprobar crea una factura; el plan
          se aplica solamente después de confirmar el pago.
        </p>
        {error && <p className={platformErrorClass}>{error}</p>}
        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <section className={`mt-6 ${platformPanelClass}`}>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando solicitudes...</p>
          ) : requests.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3">Empresa</th>
                    <th className="py-3">Plan actual</th>
                    <th className="py-3">Plan solicitado</th>
                    <th className="py-3">Solicitado por</th>
                    <th className="py-3">Fecha</th>
                    <th className="py-3">Estado</th>
                    <th className="py-3">Factura / checkout</th>
                    <th className="py-3" />
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr className="border-t border-slate-200" key={request.id}>
                      <td className="py-3 font-medium text-slate-950">
                        {request.company.name}
                      </td>
                      <td className="py-3">
                        {request.currentPlanName ?? 'N/D'}
                      </td>
                      <td className="py-3">
                        {request.requestedPlanName ?? request.requestedPlanCode}
                      </td>
                      <td className="py-3">
                        {request.requestedBy?.name ?? 'Usuario no disponible'}
                      </td>
                      <td className="py-3">{formatDate(request.createdAt)}</td>
                      <td className="py-3">{request.status}</td>
                      <td className="py-3">
                        {request.invoice?.invoiceNumber ?? 'Sin factura'}
                        {request.checkoutSession
                          ? ` · ${request.checkoutSession.status}`
                          : ''}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          onClick={() => {
                            setSelected(request);
                            setNote(request.adminNote ?? '');
                          }}
                          type="button"
                          variant="secondary"
                        >
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No hay solicitudes registradas.
            </p>
          )}
        </section>

        {selected && (
          <section className={`mt-6 ${platformPanelClass}`}>
            <h2 className="text-lg font-semibold text-slate-950">
              {selected.company.name}: {selected.currentPlanName} →{' '}
              {selected.requestedPlanName}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Estado: {selected.status}. Solicitada el{' '}
              {formatDate(selected.createdAt)} por{' '}
              {selected.requestedBy?.email ?? 'usuario no disponible'}.
            </p>
            {selected.invoice && (
              <p className="mt-2 text-sm text-slate-600">
                Factura: {selected.invoice.invoiceNumber} ·{' '}
                {selected.invoice.status}
              </p>
            )}
            {selected.checkoutSession?.checkoutUrl && (
              <a
                className="mt-2 inline-flex text-sm font-semibold text-blue-700"
                href={selected.checkoutSession.checkoutUrl}
                rel="noreferrer"
                target="_blank"
              >
                Ver checkout PayPal
              </a>
            )}
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              <span>Nota administrativa</span>
              <textarea
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={selected.status !== 'PENDING'}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                value={note}
              />
            </label>
            {selected.status === 'PENDING' && canManageBilling(user) && (
              <div className="mt-4 flex gap-3">
                <Button
                  disabled={reviewing}
                  onClick={() => void review('approve')}
                  type="button"
                >
                  {reviewing ? 'Procesando...' : 'Aprobar'}
                </Button>
                <Button
                  disabled={reviewing}
                  onClick={() => void review('reject')}
                  type="button"
                  variant="secondary"
                >
                  Rechazar
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-DO');
}
