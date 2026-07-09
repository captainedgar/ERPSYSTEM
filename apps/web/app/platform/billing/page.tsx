'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  PlatformHeader,
  PlatformMetricCard,
  PlatformSubscriptionStatusBadge,
  platformErrorClass,
  platformErrorMessage,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  listBillingPayments,
  listBillingSubscriptions,
  listPlatformCompanies,
  processOverdueBilling,
  type BillingOverdueProcessResult,
  type CompanySubscription,
  type PlatformCompany,
  type SubscriptionPayment,
} from '@/lib/platform';

const soonMs = 1000 * 60 * 60 * 24 * 7;

export default function PlatformBillingPage() {
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [processResult, setProcessResult] =
    useState<BillingOverdueProcessResult | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  async function refresh() {
    setError('');
    try {
      const [nextSubscriptions, nextPayments, nextCompanies] =
        await Promise.all([
          listBillingSubscriptions(),
          listBillingPayments(),
          listPlatformCompanies(),
        ]);
      setSubscriptions(nextSubscriptions);
      setPayments(nextPayments);
      setCompanies(nextCompanies);
      setCurrentTime(Date.now());
    } catch (reason) {
      setError(platformErrorMessage('No se pudo cargar billing.', reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      try {
        const [nextSubscriptions, nextPayments, nextCompanies] =
          await Promise.all([
            listBillingSubscriptions(),
            listBillingPayments(),
            listPlatformCompanies(),
          ]);
        if (cancelled) return;
        setSubscriptions(nextSubscriptions);
        setPayments(nextPayments);
        setCompanies(nextCompanies);
        setCurrentTime(Date.now());
      } catch (reason) {
        if (!cancelled) {
          setError(platformErrorMessage('No se pudo cargar billing.', reason));
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

  async function processNow() {
    setProcessing(true);
    setError('');
    setProcessResult(null);
    try {
      setProcessResult(await processOverdueBilling());
      await refresh();
    } catch (reason) {
      setError(
        platformErrorMessage('No se pudo procesar vencimientos.', reason),
      );
    } finally {
      setProcessing(false);
    }
  }

  const grouped = useMemo(() => {
    const now = currentTime ?? 0;
    return {
      active: subscriptions.filter((item) => item.status === 'ACTIVE'),
      dueSoon: subscriptions.filter((item) => {
        const due = new Date(item.nextPaymentDueAt).getTime();
        return item.status === 'ACTIVE' && due > now && due - now <= soonMs;
      }),
      grace: subscriptions.filter((item) => item.status === 'GRACE_PERIOD'),
      suspended: subscriptions.filter((item) => item.status === 'SUSPENDED'),
      withoutPlan: companies.filter(
        (company) =>
          !subscriptions.some(
            (subscription) => subscription.companyId === company.id,
          ),
      ),
    };
  }, [companies, currentTime, subscriptions]);

  const monthlyRevenue = grouped.active.reduce(
    (total, subscription) => total + Number(subscription.plan.price),
    0,
  );

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title="Billing SaaS" />
          <Button
            disabled={processing}
            onClick={() => void processNow()}
            type="button"
          >
            {processing ? 'Procesando...' : 'Procesar vencimientos ahora'}
          </Button>
        </div>
        {error && <p className={platformErrorClass}>{error}</p>}
        {processResult && (
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-700">
            Vencimientos procesados: {processResult.movedToGracePeriod} en
            gracia, {processResult.companiesSuspended} suspendidas,{' '}
            {processResult.noActionRequired} sin accion.
          </p>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <PlatformMetricCard
            label="MRR manual"
            tone="emerald"
            value={platformMoney(monthlyRevenue)}
          />
          <PlatformMetricCard
            label="En gracia"
            tone="amber"
            value={grouped.grace.length}
          />
          <PlatformMetricCard
            label="Suspendidas"
            tone="rose"
            value={grouped.suspended.length}
          />
          <PlatformMetricCard
            label="Sin plan"
            tone="zinc"
            value={grouped.withoutPlan.length}
          />
        </section>

        <div className="mt-6 grid gap-6">
          <SubscriptionsPanel
            loading={loading}
            subscriptions={grouped.grace}
            title="En gracia"
          />
          <SubscriptionsPanel
            loading={loading}
            subscriptions={grouped.suspended}
            title="Suspendidas"
          />
          <SubscriptionsPanel
            loading={loading}
            subscriptions={grouped.dueSoon}
            title="Proximas a vencer"
          />
          <SubscriptionsPanel
            loading={loading}
            subscriptions={grouped.active}
            title="Activas"
          />
          <Panel title="Sin plan">
            {grouped.withoutPlan.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-3">Empresa</th>
                      <th className="py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.withoutPlan.map((company) => (
                      <tr
                        className="border-t border-slate-200"
                        key={company.id}
                      >
                        <td className="py-3 font-medium text-slate-950">
                          {company.name}
                        </td>
                        <td className="py-3">{company.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="Todas las empresas tienen plan." />
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
        </div>
      </div>
    </main>
  );
}

function SubscriptionsPanel({
  loading,
  subscriptions,
  title,
}: {
  loading: boolean;
  subscriptions: CompanySubscription[];
  title: string;
}) {
  return (
    <Panel title={title}>
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
                <th className="py-3">Dias de gracia</th>
                <th className="py-3">Fin de gracia</th>
                <th className="py-3">Suspension programada</th>
                <th className="py-3">Ultimo pago</th>
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
                  <td className="py-3">{subscription.graceDays}</td>
                  <td className="py-3">
                    {formatDate(subscription.graceEndsAt)}
                  </td>
                  <td className="py-3">
                    {formatDate(subscription.scheduledSuspensionAt)}
                  </td>
                  <td className="py-3">
                    {formatDate(subscription.lastPaymentAt)}
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
        <Empty text="No hay registros en esta seccion." />
      )}
    </Panel>
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
