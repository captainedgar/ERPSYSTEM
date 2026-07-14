'use client';

import { Button } from '@comercia/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { hasPermission } from '@/lib/permissions';
import {
  downloadDataExport,
  type DataExportKind,
  type ExportFormat,
  type ExportScope,
} from '@/lib/data-export';

const exportCards: Array<{
  title: string;
  kind: DataExportKind;
  description: string;
  permission: string;
}> = [
  {
    title: 'Productos',
    kind: 'products',
    description: 'Catalogo, precios, codigos, compatibilidad y sustitutos.',
    permission: 'data_export.products',
  },
  {
    title: 'Inventario',
    kind: 'inventory',
    description: 'Stock operativo por sucursal desde inventario real.',
    permission: 'data_export.inventory',
  },
  {
    title: 'Clientes',
    kind: 'customers',
    description: 'Datos comerciales y de credito sin informacion sensible.',
    permission: 'data_export.customers',
  },
  {
    title: 'Ventas',
    kind: 'sales',
    description: 'Resumen de ventas por rango, sucursal, cliente y pagos.',
    permission: 'data_export.sales',
  },
  {
    title: 'Detalle ventas',
    kind: 'sales/items',
    description: 'Lineas vendidas con cantidades, precios, ITBIS y total.',
    permission: 'data_export.sales',
  },
  {
    title: 'Caja',
    kind: 'cash',
    description: 'Sesiones, apertura, cierre, esperado y diferencia.',
    permission: 'data_export.cash',
  },
  {
    title: 'Movimientos',
    kind: 'inventory-movements',
    description: 'Entradas, salidas, ajustes y referencias de inventario.',
    permission: 'data_export.inventory',
  },
  {
    title: 'Transferencias',
    kind: 'inventory-transfers',
    description: 'Movimientos entre sucursales con origen, destino y usuario.',
    permission: 'data_export.inventory',
  },
  {
    title: 'Docs internos',
    kind: 'internal-documents',
    description: 'Recibos, facturas internas y documentos relacionados.',
    permission: 'data_export.documents',
  },
  {
    title: 'Resumen reportes',
    kind: 'reports/overview',
    description: 'Totales operativos del rango seleccionado.',
    permission: 'data_export.view',
  },
];

export function DataExportManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<ExportScope>('active_branch');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [running, setRunning] = useState<DataExportKind | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  async function download(kind: DataExportKind) {
    setRunning(kind);
    setError('');
    setMessage('Tu archivo se esta generando...');
    try {
      await downloadDataExport(kind, {
        format: kind === 'backup' ? 'xlsx' : format,
        scope,
        from: from || undefined,
        to: to || undefined,
      });
      setMessage('Descarga iniciada.');
    } catch (reason) {
      setMessage('');
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo generar la exportacion.',
      );
    } finally {
      setRunning(null);
    }
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold text-blue-600">
            Administracion · Comercia ERP
          </p>
          <h1 className="mt-1 text-3xl font-semibold">Exportar datos</h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Descarga informacion operativa filtrada por empresa, permisos y
            sucursal activa.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label>
              Formato
              <select
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as ExportFormat)
                }
              >
                <option value="xlsx">XLSX</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label>
              Alcance
              <select
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as ExportScope)
                }
              >
                <option value="active_branch">Sucursal activa</option>
                <option value="all_branches">Todas las sucursales</option>
              </select>
            </label>
            <label>
              Desde
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          {message && <p className="mt-4 text-sm text-blue-600">{message}</p>}
          {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exportCards.map((card) =>
            hasPermission(user, card.permission) ? (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                key={card.kind}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{card.title}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {card.description}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {format.toUpperCase()}
                  </span>
                </div>
                <Button
                  className="mt-5 w-full"
                  disabled={running !== null}
                  onClick={() => void download(card.kind)}
                  type="button"
                >
                  {running === card.kind ? 'Generando...' : 'Descargar'}
                </Button>
              </article>
            ) : null,
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Backup basico</h2>
              <p className="mt-2 text-sm text-slate-500">
                Genera un XLSX multi-hoja con datos operativos y metadata.
              </p>
            </div>
            <Button
              disabled={
                running !== null ||
                !hasPermission(user, 'data_export.full_backup')
              }
              onClick={() => void download('backup')}
              type="button"
            >
              {running === 'backup' ? 'Generando...' : 'Generar backup'}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
