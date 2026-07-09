'use client';

import { useEffect, useState } from 'react';

import {
  PlatformHeader,
  platformErrorClass,
  platformPanelClass,
} from '@/components/platform-ui';
import { listPlatformAuditLogs, type PlatformAuditLog } from '@/lib/platform';

export default function PlatformAuditPage() {
  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void listPlatformAuditLogs()
      .then(setLogs)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Error'),
      );
  }, []);

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Auditoria global" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className={`mt-6 ${platformPanelClass}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-3">Evento</th>
                  <th className="py-3">Modulo</th>
                  <th className="py-3">Usuario</th>
                  <th className="py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    className="border-t border-slate-200 transition hover:bg-slate-50"
                    key={log.id}
                  >
                    <td className="py-3">
                      <p className="font-medium text-slate-950">{log.action}</p>
                      <p className="text-xs text-slate-500">
                        {log.description}
                      </p>
                    </td>
                    <td className="py-3">{log.module}</td>
                    <td className="py-3">
                      {log.platformUser?.email ?? 'Sistema'}
                    </td>
                    <td className="py-3">
                      {new Date(log.createdAt).toLocaleString('es-DO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
