'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  PlatformHeader,
  PlatformMetricCard,
  platformErrorClass,
  platformErrorMessage,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  listBillingPayments,
  type SubscriptionPayment,
  type SubscriptionPaymentMethod,
} from '@/lib/platform';

export default function PlatformPaymentsPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [method, setMethod] = useState<SubscriptionPaymentMethod | 'ALL'>(
    'ALL',
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void listBillingPayments()
      .then((nextPayments) => {
        if (!cancelled) setPayments(nextPayments);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudieron cargar los pagos.', reason),
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      if (companyId && payment.companyId !== companyId) return false;
      if (method !== 'ALL' && payment.method !== method) return false;
      if (!term) return true;
      return [
        payment.company?.name,
        payment.invoice?.invoiceNumber,
        payment.reference,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [companyId, method, payments, search]);

  const total = filtered.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Pagos SaaS" />
        {error && <p className={platformErrorClass}>{error}</p>}

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <PlatformMetricCard label="Pagos visibles" value={filtered.length} />
          <PlatformMetricCard
            label="Total cobrado"
            tone="emerald"
            value={platformMoney(total)}
          />
        </section>

        <section className={`mt-6 ${platformPanelClass}`}>
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar empresa, factura o referencia"
              value={search}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) =>
                setMethod(
                  event.target.value as SubscriptionPaymentMethod | 'ALL',
                )
              }
              value={method}
            >
              <option value="ALL">Todos los metodos</option>
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CARD_MANUAL">Tarjeta manual</option>
              <option value="CHECK">Cheque</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>

          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando pagos...</p>
            ) : filtered.length ? (
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3">Fecha</th>
                    <th className="py-3">Empresa</th>
                    <th className="py-3">Factura</th>
                    <th className="py-3">Metodo</th>
                    <th className="py-3">Referencia</th>
                    <th className="py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((payment) => (
                    <tr className="border-t border-slate-200" key={payment.id}>
                      <td className="py-3">
                        {new Date(payment.paidAt).toLocaleDateString('es-DO')}
                      </td>
                      <td className="py-3">
                        <Link
                          className={platformLinkClass}
                          href={`/platform/companies/${payment.companyId}/subscription`}
                        >
                          {payment.company?.name ?? 'Empresa'}
                        </Link>
                      </td>
                      <td className="py-3">
                        {payment.invoice ? (
                          <Link
                            className={platformLinkClass}
                            href={`/platform/billing/invoices/${payment.invoice.id}`}
                          >
                            {payment.invoice.invoiceNumber}
                          </Link>
                        ) : (
                          'Sin factura'
                        )}
                      </td>
                      <td className="py-3">{payment.method}</td>
                      <td className="py-3">{payment.reference ?? 'N/D'}</td>
                      <td className="py-3 text-right font-semibold text-slate-950">
                        {platformMoney(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">
                No hay pagos que coincidan con los filtros.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
