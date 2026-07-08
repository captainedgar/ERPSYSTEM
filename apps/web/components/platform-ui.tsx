import Link from 'next/link';

import type { PlatformAuditLog, PlatformCompany } from '@/lib/platform';

export function PlatformHeader({ title }: { title: string }) {
  return (
    <header>
      <p className="text-sm font-semibold text-cyan-300">SaaS global</p>
      <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
    </header>
  );
}

export function PlatformMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-semibold text-zinc-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function PlatformMetricCard({
  label,
  value,
  helper,
  tone = 'cyan',
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'zinc';
}) {
  const toneClasses = {
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    rose: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    zinc: 'border-zinc-700 bg-zinc-900 text-zinc-200',
  }[tone];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full border ${toneClasses}`} />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {helper && <p className="mt-2 text-sm text-zinc-500">{helper}</p>}
    </div>
  );
}

export function PlatformStatusBadge({
  status,
}: {
  status: PlatformCompany['status'];
}) {
  const classes = {
    ACTIVE: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    INACTIVE: 'border-zinc-600 bg-zinc-800 text-zinc-300',
    SUSPENDED: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  }[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

export function PlatformActivityFeed({ logs }: { logs: PlatformAuditLog[] }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Ultimas acciones</h2>
        <Link className="text-sm text-cyan-300" href="/platform/audit">
          Ver auditoria
        </Link>
      </div>
      <div className="mt-5 grid gap-4">
        {logs.length ? (
          logs.slice(0, 6).map((log) => (
            <div className="flex gap-3" key={log.id}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {log.action}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{log.description}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {log.platformUser?.email ?? 'Sistema'} /{' '}
                  {new Date(log.createdAt).toLocaleString('es-DO')}
                </p>
              </div>
            </div>
          ))
        ) : (
          <EmptyPanel title="Sin acciones recientes" />
        )}
      </div>
    </section>
  );
}

export function PlatformCompanyHealthCard({
  activeCompanies,
  inactiveCompanies,
}: {
  activeCompanies: PlatformCompany[];
  inactiveCompanies: PlatformCompany[];
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="text-lg font-semibold">Salud de empresas</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <HealthColumn
          companies={activeCompanies}
          title="Con actividad reciente"
          tone="emerald"
        />
        <HealthColumn
          companies={inactiveCompanies}
          title="Sin actividad reciente"
          tone="amber"
        />
      </div>
    </section>
  );
}

export function PlatformQuickActions({
  suspendedCount,
  fiscalErrorCount,
}: {
  suspendedCount: number;
  fiscalErrorCount: number;
}) {
  const actions = [
    {
      href: '/platform/companies',
      label: 'Ver empresas',
      value: 'Directorio',
    },
    {
      href: '/platform/audit',
      label: 'Ver auditoria',
      value: 'Eventos',
    },
    {
      href: '/platform/companies',
      label: 'Empresas suspendidas',
      value: suspendedCount,
    },
    {
      href: '/platform/dashboard#fiscal-errors',
      label: 'Errores fiscales',
      value: fiscalErrorCount,
    },
  ];

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="text-lg font-semibold">Accesos rapidos</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-cyan-400/40 hover:bg-zinc-800"
            href={action.href}
            key={action.label}
          >
            <p className="text-sm font-medium text-zinc-100">{action.label}</p>
            <p className="mt-1 text-xs text-zinc-500">{action.value}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PlatformRecentCompaniesTable({
  companies,
}: {
  companies: PlatformCompany[];
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Empresas recientes</h2>
        <Link className="text-sm text-cyan-300" href="/platform/companies">
          Ver todas
        </Link>
      </div>
      <PlatformCompanyTable companies={companies} />
    </section>
  );
}

export function PlatformFiscalErrorsPanel({ count }: { count: number }) {
  return (
    <section
      className="rounded-lg border border-zinc-800 bg-zinc-950 p-5"
      id="fiscal-errors"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Errores fiscales recientes</h2>
        <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-200">
          {count}
        </span>
      </div>
      <div className="mt-5">
        {count ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            Hay errores fiscales registrados. El detalle consolidado queda listo
            para conectarse cuando exista el endpoint de errores globales.
          </p>
        ) : (
          <EmptyPanel title="Sin errores fiscales recientes" />
        )}
      </div>
    </section>
  );
}

export function PlatformCompanyTable({
  companies,
}: {
  companies: PlatformCompany[];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-zinc-500 uppercase">
          <tr>
            <th className="py-3">Empresa</th>
            <th className="py-3">Estado</th>
            <th className="py-3">Usuarios</th>
            <th className="py-3">Ventas</th>
            <th className="py-3" />
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr className="border-t border-zinc-800" key={company.id}>
              <td className="py-3">
                <p className="font-medium">{company.name}</p>
                <p className="text-xs text-zinc-500">{company.email}</p>
              </td>
              <td className="py-3">
                <PlatformStatusBadge status={company.status} />
              </td>
              <td className="py-3">{company._count?.users ?? 0}</td>
              <td className="py-3">{company._count?.sales ?? 0}</td>
              <td className="py-3 text-right">
                <Link
                  className="text-cyan-300"
                  href={`/platform/companies/${company.id}`}
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function platformMoney(value: string | number | undefined) {
  return new Intl.NumberFormat('es-DO', {
    currency: 'DOP',
    style: 'currency',
  }).format(Number(value ?? 0));
}

function HealthColumn({
  companies,
  title,
  tone,
}: {
  companies: PlatformCompany[];
  title: string;
  tone: 'amber' | 'emerald';
}) {
  const dot = tone === 'emerald' ? 'bg-emerald-300' : 'bg-amber-300';
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-300">{title}</p>
      <div className="mt-3 grid gap-2">
        {companies.length ? (
          companies.slice(0, 4).map((company) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
              href={`/platform/companies/${company.id}`}
              key={company.id}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="truncate text-sm">{company.name}</span>
              </span>
              <span className="text-xs text-zinc-500">
                {company._count?.sales ?? 0} ventas
              </span>
            </Link>
          ))
        ) : (
          <EmptyPanel title="Sin empresas en este grupo" />
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-500">
      {title}
    </div>
  );
}
