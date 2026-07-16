'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  PlatformActivityFeed,
  PlatformCompanyHealthCard,
  PlatformFiscalErrorsPanel,
  PlatformHeader,
  PlatformMetricCard,
  PlatformQuickActions,
  PlatformRecentCompaniesTable,
  platformErrorClass,
  platformErrorMessage,
  platformMoney,
} from '@/components/platform-ui';
import {
  getPlatformMetrics,
  listBillingPayments,
  listBillingSubscriptions,
  listPlatformAuditLogs,
  listPlatformCompanies,
  listSubscriptionInvoices,
  type PlatformAuditLog,
  type PlatformCompany,
  type PlatformMetrics,
  type CompanySubscription,
  type SubscriptionInvoice,
  type SubscriptionPayment,
} from '@/lib/platform';

export default function PlatformDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          nextMetrics,
          nextCompanies,
          nextAuditLogs,
          nextSubscriptions,
          nextInvoices,
          nextPayments,
        ] = await Promise.all([
          getPlatformMetrics(),
          listPlatformCompanies(),
          listPlatformAuditLogs(),
          listBillingSubscriptions(),
          listSubscriptionInvoices(),
          listBillingPayments(),
        ]);
        if (!cancelled) {
          setMetrics(nextMetrics);
          setCompanies(nextCompanies);
          setAuditLogs(nextAuditLogs);
          setSubscriptions(nextSubscriptions);
          setInvoices(nextInvoices);
          setPayments(nextPayments);
          setLoadedAt(Date.now());
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudo cargar el dashboard.', reason),
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
  }, []);

  const companyHealth = useMemo(() => {
    const withActivity = companies
      .filter((company) => (company._count?.sales ?? 0) > 0)
      .sort(
        (a, b) => Number(b._count?.sales ?? 0) - Number(a._count?.sales ?? 0),
      );
    const withoutActivity = companies
      .filter((company) => (company._count?.sales ?? 0) === 0)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    return { withActivity, withoutActivity };
  }, [companies]);

  const recentCompanies = useMemo(
    () =>
      [...companies]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 6),
    [companies],
  );
  const billing = useMemo(() => {
    const pendingInvoices = invoices.filter((invoice) =>
      ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status),
    );
    return {
      overdueSubscriptions: subscriptions.filter((subscription) =>
        ['PAYMENT_DUE', 'GRACE_PERIOD', 'SUSPENDED'].includes(
          subscription.status,
        ),
      ).length,
      pendingInvoices: pendingInvoices.length,
      pendingBalance: pendingInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.balance),
        0,
      ),
      mrr: subscriptions
        .filter((subscription) => subscription.status === 'ACTIVE')
        .reduce((sum, subscription) => {
          const price = Number(subscription.plan.price);
          return (
            sum +
            (subscription.plan.billingInterval === 'YEARLY'
              ? price / 12
              : price)
          );
        }, 0),
      recentPayments: payments.filter(
        (payment) =>
          loadedAt - new Date(payment.paidAt).getTime() <=
          1000 * 60 * 60 * 24 * 30,
      ).length,
    };
  }, [invoices, loadedAt, payments, subscriptions]);

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title="Centro de Control SaaS" />
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {loading ? 'Sincronizando datos...' : 'Estado global actualizado'}
          </div>
        </div>

        {error && <p className={platformErrorClass}>{error}</p>}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PlatformMetricCard
            helper="Empresas registradas"
            label="Total empresas"
            value={metrics?.totalCompanies ?? '...'}
          />
          <PlatformMetricCard
            helper="Operando normalmente"
            label="Activas"
            tone="emerald"
            value={metrics?.activeCompanies ?? '...'}
          />
          <PlatformMetricCard
            helper="Acceso operativo pausado"
            label="Suspendidas"
            tone="rose"
            value={metrics?.suspendedCompanies ?? '...'}
          />
          <PlatformMetricCard
            helper="Planes activos mensualizados"
            label="MRR estimado"
            tone="emerald"
            value={platformMoney(billing.mrr)}
          />
          <PlatformMetricCard
            helper="Pendientes, en gracia o suspendidas"
            label="Alertas de cobro"
            tone={billing.overdueSubscriptions ? 'rose' : 'emerald'}
            value={billing.overdueSubscriptions}
          />
          <PlatformMetricCard
            helper="Con balance por cobrar"
            label="Facturas pendientes"
            tone="amber"
            value={billing.pendingInvoices}
          />
          <PlatformMetricCard
            helper="Balance de facturas abiertas"
            label="Balance pendiente"
            tone="cyan"
            value={platformMoney(billing.pendingBalance)}
          />
          <PlatformMetricCard
            helper="Ultimos 30 dias"
            label="Pagos recientes"
            tone="emerald"
            value={billing.recentPayments}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <PlatformCompanyHealthCard
            activeCompanies={companyHealth.withActivity}
            inactiveCompanies={companyHealth.withoutActivity}
          />
          <PlatformQuickActions
            fiscalErrorCount={metrics?.fiscalErrors ?? 0}
            suspendedCount={metrics?.suspendedCompanies ?? 0}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <PlatformRecentCompaniesTable companies={recentCompanies} />
          <div className="grid gap-6">
            <PlatformFiscalErrorsPanel count={metrics?.fiscalErrors ?? 0} />
            <PlatformActivityFeed logs={auditLogs} />
          </div>
        </section>
      </div>
    </main>
  );
}
