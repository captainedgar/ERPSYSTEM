import Link from 'next/link';
import type { ReactNode } from 'react';

import type {
  CompanySubscription,
  CompanySubscriptionStatus,
  PlatformAuditLog,
  PlatformCompany,
} from '@/lib/platform';

export const platformInputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
export const platformLabelClass =
  'grid gap-1 text-sm font-medium text-slate-700';
export const platformPanelClass =
  'rounded-lg border border-slate-200 bg-white p-5 shadow-sm';
export const platformLinkClass =
  'text-sm font-semibold text-blue-700 underline-offset-4 hover:text-blue-800 hover:underline';
export const platformErrorClass =
  'mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700';

export function platformErrorMessage(message: string, reason: unknown) {
  if (process.env.NODE_ENV !== 'development' || !(reason instanceof Error)) {
    return message;
  }
  return `${message} Detalle: ${reason.message}`;
}

export function PlatformHeader({
  eyebrow = 'SaaS global',
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <header>
      <p className="text-sm font-semibold text-blue-700">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-semibold text-slate-950">{title}</h1>
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
    <div className={platformPanelClass}>
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
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
  const dot = {
    amber: 'border-amber-200 bg-amber-500',
    cyan: 'border-blue-200 bg-blue-600',
    emerald: 'border-emerald-200 bg-emerald-600',
    rose: 'border-red-200 bg-red-600',
    zinc: 'border-slate-200 bg-slate-500',
  }[tone];

  return (
    <div className={platformPanelClass}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full border ${dot}`} />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {helper && <p className="mt-2 text-sm text-slate-600">{helper}</p>}
    </div>
  );
}

export function PlatformStatusBadge({
  status,
}: {
  status: PlatformCompany['status'];
}) {
  const classes = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    INACTIVE: 'border-slate-200 bg-slate-100 text-slate-700',
    SUSPENDED: 'border-red-200 bg-red-50 text-red-700',
  }[status];
  return <Badge className={classes}>{status}</Badge>;
}

export function PlatformSubscriptionStatusBadge({
  status,
}: {
  status: CompanySubscriptionStatus;
}) {
  const classes = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CANCELLED: 'border-slate-200 bg-slate-100 text-slate-700',
    GRACE_PERIOD: 'border-amber-200 bg-amber-50 text-amber-700',
    PAYMENT_DUE: 'border-orange-200 bg-orange-50 text-orange-700',
    SUSPENDED: 'border-red-200 bg-red-50 text-red-700',
    TRIAL: 'border-blue-200 bg-blue-50 text-blue-700',
  }[status];
  return <Badge className={classes}>{status}</Badge>;
}

export function PlatformActivityFeed({ logs }: { logs: PlatformAuditLog[] }) {
  return (
    <section className={platformPanelClass}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950">
          Ultimas acciones
        </h2>
        <Link className={platformLinkClass} href="/platform/audit">
          Ver auditoria
        </Link>
      </div>
      <div className="mt-5 grid gap-4">
        {logs.length ? (
          logs.slice(0, 6).map((log) => (
            <div className="flex gap-3" key={log.id}>
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-950">
                  {log.action}
                </p>
                <p className="mt-1 text-sm text-slate-600">{log.description}</p>
                <p className="mt-1 text-xs text-slate-500">
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
    <section className={platformPanelClass}>
      <h2 className="text-lg font-semibold text-slate-950">
        Salud de empresas
      </h2>
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
    { href: '/platform/companies', label: 'Ver empresas', value: 'Directorio' },
    { href: '/platform/audit', label: 'Ver auditoria', value: 'Eventos' },
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
    <section className={platformPanelClass}>
      <h2 className="text-lg font-semibold text-slate-950">Accesos rapidos</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50"
            href={action.href}
            key={action.label}
          >
            <p className="text-sm font-medium text-slate-950">{action.label}</p>
            <p className="mt-1 text-xs text-slate-600">{action.value}</p>
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
    <section className={platformPanelClass}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950">
          Empresas recientes
        </h2>
        <Link className={platformLinkClass} href="/platform/companies">
          Ver todas
        </Link>
      </div>
      <PlatformCompanyTable companies={companies} />
    </section>
  );
}

export function PlatformFiscalErrorsPanel({ count }: { count: number }) {
  return (
    <section className={platformPanelClass} id="fiscal-errors">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950">
          Errores fiscales recientes
        </h2>
        <Badge className="border-red-200 bg-red-50 text-red-700">{count}</Badge>
      </div>
      <div className="mt-5">
        {count ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
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
  subscriptions = [],
}: {
  companies: PlatformCompany[];
  subscriptions?: CompanySubscription[];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-700">
        <thead className="text-xs text-slate-500 uppercase">
          <tr>
            <th className="py-3">Empresa</th>
            <th className="py-3">Estado</th>
            <th className="py-3">Usuarios</th>
            <th className="py-3">Ventas</th>
            <th className="py-3">Plan</th>
            <th className="py-3">Suscripcion</th>
            <th className="py-3" />
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const subscription = subscriptions.find(
              (item) => item.companyId === company.id,
            );
            return (
              <tr
                className="border-t border-slate-200 transition hover:bg-slate-50"
                key={company.id}
              >
                <td className="py-3">
                  <p className="font-medium text-slate-950">{company.name}</p>
                  <p className="text-xs text-slate-500">
                    {company.email ?? company.rncOrCedula ?? 'Sin correo'}
                  </p>
                </td>
                <td className="py-3">
                  <PlatformStatusBadge status={company.status} />
                </td>
                <td className="py-3">{company._count?.users ?? 0}</td>
                <td className="py-3">{company._count?.sales ?? 0}</td>
                <td className="py-3">
                  {subscription?.plan.name ?? (
                    <span className="text-slate-500">Sin plan</span>
                  )}
                </td>
                <td className="py-3">
                  {subscription ? (
                    <PlatformSubscriptionStatusBadge
                      status={subscription.status}
                    />
                  ) : (
                    <span className="text-slate-500">N/D</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      className={platformLinkClass}
                      href={`/platform/companies/${company.id}`}
                    >
                      Abrir
                    </Link>
                    <Link
                      className={platformLinkClass}
                      href={`/platform/companies/${company.id}/subscription`}
                    >
                      Suscripcion
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!companies.length && <EmptyPanel title="No hay empresas para mostrar" />}
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
  const dot = tone === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500';
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="mt-3 grid gap-2">
        {companies.length ? (
          companies.slice(0, 4).map((company) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-300 hover:bg-blue-50"
              href={`/platform/companies/${company.id}`}
              key={company.id}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="truncate text-sm text-slate-950">
                  {company.name}
                </span>
              </span>
              <span className="text-xs text-slate-600">
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

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      {title}
    </div>
  );
}
