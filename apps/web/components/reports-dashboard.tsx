'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { reportsApi, type ReportFilters } from '@/lib/reports';

type ReportKind =
  'overview' | 'sales' | 'cash' | 'inventory' | 'customers' | 'documents';

const titles: Record<ReportKind, { title: string; subtitle: string }> = {
  overview: {
    title: 'Reportes',
    subtitle: 'Resumen operativo de la sucursal activa.',
  },
  sales: {
    title: 'Reporte de ventas',
    subtitle: 'Ventas por dia, usuario, productos y documentos recientes.',
  },
  cash: {
    title: 'Reporte de caja',
    subtitle: 'Sesiones, entradas, salidas y diferencias de caja.',
  },
  inventory: {
    title: 'Reporte de inventario',
    subtitle: 'Productos con stock bajo en la empresa.',
  },
  customers: {
    title: 'Reporte de clientes',
    subtitle: 'Clientes activos, recientes y principales por venta.',
  },
  documents: {
    title: 'Reporte de documentos',
    subtitle: 'Documentos internos por estado, tipo y recientes.',
  },
};

export function ReportsDashboard({ kind }: { kind: ReportKind }) {
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filters = useMemo(
    () => presetFilters(preset, customFrom, customTo),
    [customFrom, customTo, preset],
  );

  useEffect(() => {
    let cancelled = false;
    loadReport(kind, filters)
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData as Record<string, unknown>);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el reporte.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, kind]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              Analitica
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              {titles[kind].title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {titles[kind].subtitle}
            </p>
          </div>
          <DateFilters
            customFrom={customFrom}
            customTo={customTo}
            preset={preset}
            setCustomFrom={setCustomFrom}
            setCustomTo={setCustomTo}
            setPreset={setPreset}
          />
        </header>

        <ReportNav />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            Cargando reporte...
          </div>
        ) : (
          <ReportContent data={data} kind={kind} />
        )}
      </div>
    </main>
  );
}

function ReportContent({
  data,
  kind,
}: {
  data: Record<string, unknown>;
  kind: ReportKind;
}) {
  if (kind === 'overview') return <Overview data={data} />;
  if (kind === 'sales') return <Sales data={data} />;
  if (kind === 'cash') return <Cash data={data} />;
  if (kind === 'inventory') return <Inventory data={data} />;
  if (kind === 'customers') return <Customers data={data} />;
  return <Documents data={data} />;
}

function Overview({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-6">
      <MetricGrid
        items={[
          ['Ventas', money(number(data.totalSales))],
          ['Transacciones', String(number(data.salesCount))],
          ['Ticket promedio', money(number(data.averageTicket))],
          ['Caja efectivo', money(number(data.cashTotal))],
          ['Clientes', String(number(data.customersCount))],
          ['Stock bajo', String(number(data.lowStockCount))],
          ['Documentos', String(number(data.internalDocumentsCount))],
          [
            'Sucursal',
            text(object(data.activeBranch)?.name, 'Sucursal activa'),
          ],
        ]}
      />
      <QuickLinks />
    </div>
  );
}

function Sales({ data }: { data: Record<string, unknown> }) {
  const sales = object(data.sales);
  const byDay = array(object(data.byDay)?.items);
  const byUser = array(object(data.byUser)?.items);
  const products = array(object(data.topProducts)?.items);
  return (
    <div className="grid gap-6">
      <MetricGrid
        items={[
          ['Total vendido', money(number(sales?.total))],
          ['Ventas', String(number(sales?.count))],
          ['Ticket promedio', money(number(sales?.averageTicket))],
          ['Canceladas', String(number(sales?.cancelledCount))],
        ]}
      />
      <Panel title="Ventas por dia">
        <SimpleBars items={byDay} labelKey="date" valueKey="total" />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ventas por usuario">
          <SimpleTable
            columns={['Usuario', 'Ventas', 'Total']}
            rows={byUser.map((row) => [
              text(row.userName, 'Usuario'),
              text(row.salesCount, '0'),
              money(number(row.total)),
            ])}
          />
        </Panel>
        <Panel title="Productos mas vendidos">
          <SimpleTable
            columns={['Producto', 'Cantidad', 'Total']}
            rows={products.map((row) => [
              text(row.name, 'Producto'),
              text(row.quantitySold, '0'),
              money(number(row.totalSold)),
            ])}
          />
        </Panel>
      </div>
      <Panel title="Ventas recientes">
        <SimpleTable
          columns={['Numero', 'Cliente', 'Usuario', 'Estado', 'Total']}
          rows={array(sales?.items).map((row) => [
            text(row.saleNumber),
            text(object(row.customer)?.name, 'Consumidor final'),
            text(object(row.user)?.name),
            text(row.status),
            money(number(row.total)),
          ])}
        />
      </Panel>
    </div>
  );
}

function Cash({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-6">
      <MetricGrid
        items={[
          ['Sesiones', String(number(data.sessionsCount))],
          ['Abiertas', String(number(data.openedSessions))],
          ['Cerradas', String(number(data.closedSessions))],
          ['Ventas efectivo', money(number(data.cashSalesTotal))],
          ['Entradas', money(number(data.manualInTotal))],
          ['Salidas', money(number(data.manualOutTotal))],
          ['Esperado', money(number(data.expectedCashTotal))],
          ['Diferencia', money(number(data.differenceTotal))],
        ]}
      />
      <Panel title="Sesiones de caja">
        <SimpleTable
          columns={['Sucursal', 'Estado', 'Apertura', 'Esperado', 'Diferencia']}
          rows={array(data.sessions).map((row) => [
            text(object(row.branch)?.name),
            text(row.status),
            money(number(row.openingAmount)),
            money(number(row.expectedCashAmount)),
            row.differenceAmount == null
              ? 'N/D'
              : money(number(row.differenceAmount)),
          ])}
        />
      </Panel>
    </div>
  );
}

function Inventory({ data }: { data: Record<string, unknown> }) {
  return (
    <Panel title="Productos bajo stock">
      <SimpleTable
        columns={['Producto', 'SKU', 'Stock', 'Minimo', 'Estado']}
        rows={array(data.items).map((row) => [
          text(row.name),
          text(row.sku, 'N/D'),
          text(row.currentStock, '0'),
          text(row.minStock, '0'),
          text(row.status),
        ])}
      />
    </Panel>
  );
}

function Customers({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-6">
      <MetricGrid
        items={[
          ['Clientes', String(number(data.totalCustomers))],
          ['Activos', String(number(data.activeCustomers))],
          ['Inactivos', String(number(data.inactiveCustomers))],
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Clientes principales">
          <SimpleTable
            columns={['Cliente', 'Ventas', 'Total']}
            rows={array(data.topCustomersBySales).map((row) => [
              text(row.customerName),
              text(row.salesCount, '0'),
              money(number(row.total)),
            ])}
          />
        </Panel>
        <Panel title="Clientes recientes">
          <SimpleTable
            columns={['Cliente', 'Documento', 'Estado']}
            rows={array(data.recentCustomers).map((row) => [
              text(row.name),
              text(row.documentNumber, 'N/D'),
              text(row.status),
            ])}
          />
        </Panel>
      </div>
    </div>
  );
}

function Documents({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="grid gap-6">
      <MetricGrid
        items={[['Documentos', String(number(data.totalDocuments))]]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Por estado">
          <KeyValueTable values={object(data.documentsByStatus)} />
        </Panel>
        <Panel title="Por tipo">
          <KeyValueTable values={object(data.documentsByType)} />
        </Panel>
      </div>
      <Panel title="Documentos recientes">
        <SimpleTable
          columns={['Numero', 'Tipo', 'Estado', 'Cliente', 'Total']}
          rows={array(data.recentDocuments).map((row) => [
            text(row.documentNumber),
            text(row.documentType),
            text(row.status),
            text(object(row.customer)?.name, 'N/D'),
            money(number(row.total)),
          ])}
        />
      </Panel>
    </div>
  );
}

function DateFilters({
  customFrom,
  customTo,
  preset,
  setCustomFrom,
  setCustomTo,
  setPreset,
}: {
  customFrom: string;
  customTo: string;
  preset: string;
  setCustomFrom: (value: string) => void;
  setCustomTo: (value: string) => void;
  setPreset: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[180px_1fr_1fr]">
      <label>
        Rango
        <select
          value={preset}
          onChange={(event) => setPreset(event.target.value)}
        >
          <option value="today">Hoy</option>
          <option value="7">Ultimos 7 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="month">Mes actual</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      <label>
        Desde
        <input
          disabled={preset !== 'custom'}
          type="date"
          value={customFrom}
          onChange={(event) => setCustomFrom(event.target.value)}
        />
      </label>
      <label>
        Hasta
        <input
          disabled={preset !== 'custom'}
          type="date"
          value={customTo}
          onChange={(event) => setCustomTo(event.target.value)}
        />
      </label>
    </div>
  );
}

function ReportNav() {
  const links: Array<[string, string]> = [
    ['/reports', 'Overview'],
    ['/reports/sales', 'Ventas'],
    ['/reports/cash', 'Caja'],
    ['/reports/inventory', 'Inventario'],
    ['/reports/customers', 'Clientes'],
    ['/reports/documents', 'Documentos'],
  ];
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1">
      {links.map(([href, label]) => (
        <Link
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function QuickLinks() {
  const links: Array<[string, string]> = [
    ['/reports/sales', 'Ventas'],
    ['/reports/cash', 'Caja'],
    ['/reports/inventory', 'Inventario bajo'],
    ['/reports/customers', 'Clientes'],
    ['/reports/documents', 'Documentos'],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {links.map(([href, label]) => (
        <Link
          className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-800 shadow-sm hover:border-blue-200 hover:text-blue-700"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function MetricGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <article
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          key={label}
        >
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {label}
          </p>
          <p className="mt-3 truncate text-xl font-semibold text-slate-950">
            {value}
          </p>
        </article>
      ))}
    </section>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SimpleBars({
  items,
  labelKey,
  valueKey,
}: {
  items: Array<Record<string, unknown>>;
  labelKey: string;
  valueKey: string;
}) {
  const max = Math.max(...items.map((item) => number(item[valueKey])), 1);
  if (!items.length) return <Empty />;
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div className="grid gap-1" key={text(item[labelKey])}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">
              {text(item[labelKey]).slice(0, 10)}
            </span>
            <span className="font-semibold text-slate-900">
              {money(number(item[valueKey]))}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${(number(item[valueKey]) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            {columns.map((column) => (
              <th className="border-b border-slate-200 py-3 pr-4" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td className="py-3 pr-4 text-slate-700" key={cellIndex}>
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

function KeyValueTable({ values }: { values: Record<string, unknown> | null }) {
  const rows = Object.entries(values ?? {}).map(([key, value]) => [
    key,
    text(value),
  ]);
  return <SimpleTable columns={['Categoria', 'Total']} rows={rows} />;
}

function Empty() {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
      No hay datos para el rango seleccionado.
    </div>
  );
}

async function loadReport(kind: ReportKind, filters: ReportFilters) {
  if (kind === 'overview') return reportsApi.overview(filters);
  if (kind === 'sales') {
    const [sales, byDay, byUser, topProducts] = await Promise.all([
      reportsApi.sales(filters),
      reportsApi.salesByDay(filters),
      reportsApi.salesByUser(filters),
      reportsApi.topProducts(filters),
    ]);
    return { sales, byDay, byUser, topProducts };
  }
  if (kind === 'cash') return reportsApi.cash(filters);
  if (kind === 'inventory') return reportsApi.lowStock();
  if (kind === 'customers') return reportsApi.customers(filters);
  return reportsApi.documents(filters);
}

function presetFilters(
  preset: string,
  customFrom: string,
  customTo: string,
): ReportFilters {
  const now = new Date();
  const from = new Date(now);
  if (preset === 'custom') {
    return {
      from: customFrom ? `${customFrom}T00:00:00.000Z` : undefined,
      to: customTo ? `${customTo}T23:59:59.999Z` : undefined,
    };
  }
  if (preset === '7') from.setDate(now.getDate() - 6);
  if (preset === '30') from.setDate(now.getDate() - 29);
  if (preset === 'month') from.setDate(1);
  from.setHours(0, 0, 0, 0);
  now.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: now.toISOString() };
}

function money(value: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(value);
}

function number(value: unknown) {
  return Number(value ?? 0);
}

function text(value: unknown, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function object(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}
