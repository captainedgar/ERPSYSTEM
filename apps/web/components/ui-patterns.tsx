import type { ReactNode } from 'react';

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="page-header flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-sm font-semibold text-blue-600">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  tone = 'blue',
  value,
}: {
  label: string;
  tone?: 'blue' | 'green' | 'amber' | 'cyan';
  value: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    cyan: 'bg-cyan-50 text-cyan-700',
  };
  return (
    <article className="section-card p-5">
      <span
        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
      >
        {label}
      </span>
      <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}

export function EmptyState({
  children,
  title,
}: {
  children?: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <p className="font-medium text-slate-950">{title}</p>
      {children && (
        <div className="mt-2 text-sm text-slate-500">{children}</div>
      )}
    </div>
  );
}
