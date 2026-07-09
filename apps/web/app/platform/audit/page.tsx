'use client';

import { useEffect, useState } from 'react';

import {
  PlatformHeader,
  platformErrorClass,
  platformErrorMessage,
  platformPanelClass,
} from '@/components/platform-ui';
import { listPlatformAuditLogs, type PlatformAuditLog } from '@/lib/platform';

export default function PlatformAuditPage() {
  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextLogs = await listPlatformAuditLogs();
        if (!cancelled) setLogs(nextLogs);
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudo cargar la auditoria.', reason),
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

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Auditoria Platform" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className={`mt-6 ${platformPanelClass}`}>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-slate-600">Cargando auditoria...</p>
            ) : logs.length ? (
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3">Fecha</th>
                    <th className="py-3">Accion</th>
                    <th className="py-3">Modulo</th>
                    <th className="py-3">Usuario</th>
                    <th className="py-3">Descripcion</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      className="border-t border-slate-200 align-top transition hover:bg-slate-50"
                      key={log.id}
                    >
                      <td className="py-3 text-slate-600">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3 font-medium text-slate-950">
                        {log.action}
                      </td>
                      <td className="py-3">{log.module}</td>
                      <td className="py-3">
                        {log.platformUser?.email ?? 'Sistema'}
                      </td>
                      <td className="max-w-xl py-3 text-slate-600">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                No hay eventos de auditoria para mostrar.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-DO');
}
