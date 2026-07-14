'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  financialDashboardApi,
  type FinancialDashboardData,
  type FinancialDashboardFilters,
  type FinancialDashboardScope,
} from '@/lib/financial-dashboard';

type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

export function FinancialDashboardManager() {
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scope, setScope] = useState<FinancialDashboardScope>('active_branch');
  const [data, setData] = useState<FinancialDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filters = useMemo(
    () => ({ ...presetFilters(preset, from, to), scope }),
    [from, preset, scope, to],
  );

  useEffect(() => {
    let cancelled = false;
    financialDashboardApi
      .all(filters)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setError('');
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el dashboard financiero.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              Analitica
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Dashboard financiero
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Ventas, caja, inventario valorizado, clientes y sucursales.
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[150px_150px_150px] xl:grid-cols-[160px_160px_160px_170px]">
            <Field label="Periodo">
              <select
                className={inputClass}
                value={preset}
                onChange={(event) => setPreset(event.target.value as Preset)}
              >
                <option value="today">Hoy</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
                <option value="month">Mes actual</option>
                <option value="custom">Personalizado</option>
              </select>
            </Field>
            <Field label="Desde">
              <input
                className={inputClass}
                disabled={preset !== 'custom'}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field label="Hasta">
              <input
                className={inputClass}
                disabled={preset !== 'custom'}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Field label="Alcance">
              <select
                className={inputClass}
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as FinancialDashboardScope)
                }
              >
                <option value="active_branch">Sucursal activa</option>
                <option value="all_branches">Todas</option>
              </select>
            </Field>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Cargando dashboard financiero...
          </div>
        ) : (
          <DashboardContent data={data} scope={scope} />
        )}
      </div>
    </main>
  );
}

function DashboardContent({
  data,
  scope,
}: {
  data: FinancialDashboardData;
  scope: FinancialDashboardScope;
}) {
  const summary = data.summary;
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Ventas brutas"
          value={money(summary.grossSales)}
          delta={summary.comparison.grossSalesChangePercent}
        />
        <Kpi
          label="Cobrado"
          value={money(summary.cashCollected)}
          tone="emerald"
        />
        <Kpi
          label="Ticket promedio"
          value={money(summary.averageTicket)}
          delta={summary.comparison.averageTicketChangePercent}
        />
        <Kpi
          label="Margen estimado"
          value={`${number(summary.estimatedGrossMargin)}%`}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Panel title="Tendencia de ventas">
          <Bars
            items={data.trend.items.map((item) => ({
              label: shortDate(item.date),
              value: item.grossSales,
              detail: `${item.salesCount} ventas`,
            }))}
          />
        </Panel>
        <Panel title="Metodos de pago">
          <Bars
            compact
            items={data.paymentMethods.items.map((item) => ({
              label: item.label,
              value: item.amount,
              detail: `${number(item.percentage)}%`,
            }))}
          />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Caja">
          <MetricRows
            rows={[
              ['Sesiones abiertas', String(data.cashHealth.openSessions)],
              ['Sesiones cerradas', String(data.cashHealth.closedSessions)],
              ['Efectivo esperado', money(data.cashHealth.expectedCash)],
              ['Diferencia total', money(data.cashHealth.differenceTotal)],
              ['Mayor diferencia', money(data.cashHealth.largestDifference)],
            ]}
          />
        </Panel>
        <Panel title="Inventario valorizado">
          <MetricRows
            rows={[
              ['Valor costo', money(data.inventoryValue.inventoryCostValue)],
              ['Valor venta', money(data.inventoryValue.inventorySaleValue)],
              [
                'Margen potencial',
                `${number(data.inventoryValue.estimatedPotentialMargin)}%`,
              ],
              [
                'Productos con stock',
                String(data.inventoryValue.productsWithStock),
              ],
              ['Stock bajo', String(data.inventoryValue.lowStockProducts)],
            ]}
          />
        </Panel>
        <Panel title="Alertas">
          <div className="grid gap-3">
            {data.alerts.items.map((item) => (
              <Link
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${alertClass(
                  item.severity,
                )}`}
                href={item.actionUrl}
                key={item.type}
              >
                <span className="min-w-0 truncate font-medium">
                  {item.title}
                </span>
                <span className="shrink-0 font-semibold">{item.count}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      {scope === 'all_branches' && data.branches && (
        <Panel title="Sucursales">
          <DataTable
            columns={['Sucursal', 'Ventas', 'Total', 'Cobrado', 'Ticket']}
            rows={data.branches.items.map((item) => [
              item.branchName,
              String(item.salesCount),
              money(item.grossSales),
              money(item.cashCollected),
              money(item.averageTicket),
            ])}
          />
        </Panel>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Productos top">
          <DataTable
            columns={['Producto', 'Cantidad', 'Vendido', 'Utilidad', 'Stock']}
            rows={data.topProducts.items.map((item) => [
              item.name,
              number(item.quantitySold),
              money(item.grossSales),
              money(item.estimatedProfit),
              number(item.stockInActiveBranch),
            ])}
          />
        </Panel>
        <Panel title="Clientes top">
          <DataTable
            columns={['Cliente', 'Ventas', 'Comprado', 'Balance']}
            rows={data.topCustomers.items.map((item) => [
              item.customerName,
              String(item.salesCount),
              money(item.totalPurchased),
              money(item.pendingBalance),
            ])}
          />
        </Panel>
      </section>

      {data.inventoryValue.stockByBranch.length > 0 && (
        <Panel title="Inventario por sucursal">
          <DataTable
            columns={['Sucursal', 'Productos', 'Valor costo', 'Valor venta']}
            rows={data.inventoryValue.stockByBranch.map((item) => [
              item.branchName,
              String(item.productsWithStock),
              money(item.inventoryCostValue),
              money(item.inventorySaleValue),
            ])}
          />
        </Panel>
      )}
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-500 uppercase">
      {label}
      {children}
    </label>
  );
}

function Kpi({
  delta,
  label,
  tone = 'blue',
  value,
}: {
  delta?: number;
  label: string;
  tone?: 'blue' | 'emerald' | 'amber';
  value: string;
}) {
  const toneClass = {
    blue: 'border-blue-100 bg-blue-50/60 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-700',
  }[tone];
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {delta !== undefined && (
          <span className={`rounded-md border px-2 py-1 text-xs ${toneClass}`}>
            {delta >= 0 ? '+' : ''}
            {number(delta)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bars({
  compact = false,
  items,
}: {
  compact?: boolean;
  items: Array<{ label: string; value: number; detail: string }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) {
    return <p className="text-sm text-slate-500">Sin datos en el periodo.</p>;
  }
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-[110px_1fr_130px] sm:items-center'}`}
          key={item.label}
        >
          <p className="truncate text-sm font-medium text-slate-600">
            {item.label}
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }}
            />
          </div>
          <p className="text-right text-sm font-semibold text-slate-900">
            {money(item.value)}{' '}
            <span className="font-normal text-slate-500">{item.detail}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function MetricRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div
          className="flex items-center justify-between gap-4 py-2"
          key={label}
        >
          <span className="text-sm text-slate-500">{label}</span>
          <span className="text-sm font-semibold text-slate-950">{value}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Sin datos en el periodo.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {columns.map((column) => (
              <th className="px-3 py-2" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td
                  className={`px-3 py-3 ${
                    cellIndex === 0
                      ? 'max-w-[260px] truncate font-medium text-slate-900'
                      : 'text-slate-600'
                  }`}
                  key={`${cell}-${cellIndex}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function presetFilters(
  preset: Preset,
  customFrom: string,
  customTo: string,
): Omit<FinancialDashboardFilters, 'scope'> {
  const today = new Date();
  const to = dateInput(today);
  if (preset === 'custom') return { from: customFrom, to: customTo };
  if (preset === 'today') return { from: to, to };
  if (preset === 'month') {
    return {
      from: dateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
      to,
    };
  }
  const days = preset === '7d' ? 6 : 29;
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return { from: dateInput(from), to };
}

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat('es-DO', {
    currency: 'DOP',
    style: 'currency',
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat('es-DO', {
    maximumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function alertClass(severity: string) {
  if (severity === 'danger') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (severity === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

const inputClass =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';
