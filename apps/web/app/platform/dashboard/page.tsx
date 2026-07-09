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
  platformMoney,
} from '@/components/platform-ui';
import {
  getPlatformMetrics,
  listPlatformAuditLogs,
  listPlatformCompanies,
  type PlatformAuditLog,
  type PlatformCompany,
  type PlatformMetrics,
} from '@/lib/platform';

export default function PlatformDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextMetrics, nextCompanies, nextAuditLogs] = await Promise.all([
          getPlatformMetrics(),
          listPlatformCompanies(),
          listPlatformAuditLogs(),
        ]);
        if (!cancelled) {
          setMetrics(nextMetrics);
          setCompanies(nextCompanies);
          setAuditLogs(nextAuditLogs);
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

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title="Centro de Control SaaS" />
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
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
            helper="Usuarios de empresas"
            label="Usuarios totales"
            tone="zinc"
            value={metrics?.totalUsers ?? '...'}
          />
          <PlatformMetricCard
            helper={`${metrics?.totalSales ?? 0} ventas registradas`}
            label="Ventas agregadas"
            tone="cyan"
            value={platformMoney(metrics?.totalSalesAmount)}
          />
          <PlatformMetricCard
            helper="Recibos y facturas internas"
            label="Docs internos"
            tone="amber"
            value={metrics?.internalDocuments ?? '...'}
          />
          <PlatformMetricCard
            helper="Modulo fiscal mock"
            label="Docs fiscales"
            tone="cyan"
            value={metrics?.electronicInvoices ?? '...'}
          />
          <PlatformMetricCard
            helper="Errores agregados"
            label="Alertas fiscales"
            tone={metrics?.fiscalErrors ? 'rose' : 'emerald'}
            value={metrics?.fiscalErrors ?? '...'}
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
