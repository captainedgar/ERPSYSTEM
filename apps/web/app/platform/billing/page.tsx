'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import {
  PlatformHeader,
  PlatformMetricCard,
  PlatformSubscriptionStatusBadge,
  platformErrorClass,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  listBillingPayments,
  listBillingSubscriptions,
  type CompanySubscription,
  type SubscriptionPayment,
} from '@/lib/platform';

export default function PlatformBillingPage() {
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextSubscriptions, nextPayments] = await Promise.all([
          listBillingSubscriptions(),
          listBillingPayments(),
        ]);
        if (!cancelled) {
          setSubscriptions(nextSubscriptions);
          setPayments(nextPayments);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthlyRevenue = subscriptions
    .filter((subscription) => subscription.status === 'ACTIVE')
    .reduce(
      (total, subscription) => total + Number(subscription.plan.price),
      0,
    );
  const due = subscriptions.filter((subscription) =>
    ['PAYMENT_DUE', 'GRACE_PERIOD'].includes(subscription.status),
  ).length;
  const suspended = subscriptions.filter(
    (subscription) => subscription.status === 'SUSPENDED',
  ).length;

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Billing SaaS" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <PlatformMetricCard
            label="MRR manual"
            tone="emerald"
            value={platformMoney(monthlyRevenue)}
          />
          <PlatformMetricCard
            label="Suscripciones"
            value={subscriptions.length}
          />
          <PlatformMetricCard label="Por cobrar" tone="amber" value={due} />
          <PlatformMetricCard
            label="Suspendidas"
            tone="rose"
            value={suspended}
          />
        </section>
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Suscripciones">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando billing...</p>
            ) : subscriptions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-3">Empresa</th>
                      <th className="py-3">Plan</th>
                      <th className="py-3">Estado</th>
                      <th className="py-3">Proximo pago</th>
                      <th className="py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr
                        className="border-t border-slate-200 transition hover:bg-slate-50"
                        key={subscription.id}
                      >
                        <td className="py-3 font-medium text-slate-950">
                          {subscription.company?.name ?? 'N/D'}
                        </td>
                        <td className="py-3">{subscription.plan.name}</td>
                        <td className="py-3">
                          <PlatformSubscriptionStatusBadge
                            status={subscription.status}
                          />
                        </td>
                        <td className="py-3">
                          {formatDate(subscription.nextPaymentDueAt)}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            className={platformLinkClass}
                            href={`/platform/companies/${subscription.companyId}/subscription`}
                          >
                            Gestionar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="No hay suscripciones asignadas." />
            )}
          </Panel>
          <Panel title="Pagos recientes">
            {payments.length ? (
              <div className="grid gap-3">
                {payments.map((payment) => (
                  <Link
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50"
                    href={`/platform/companies/${payment.companyId}/subscription`}
                    key={payment.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {payment.company?.name ?? 'Empresa'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.method} / {formatDate(payment.paidAt)}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-950">
                        {platformMoney(payment.amount)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty text="No hay pagos manuales registrados." />
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={platformPanelClass}>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      {text}
    </p>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/D';
  return new Date(value).toLocaleDateString('es-DO');
}
