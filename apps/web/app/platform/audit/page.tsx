'use client';

import { useEffect, useMemo, useState } from 'react';

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
  const [action, setAction] = useState('');
  const [company, setCompany] = useState('');
  const [platformUser, setPlatformUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  const actions = useMemo(
    () => [...new Set(logs.map((log) => log.action))].sort(),
    [logs],
  );
  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        const createdAt = new Date(log.createdAt);
        const companyTerm = company.trim().toLowerCase();
        if (action && log.action !== action) return false;
        if (
          platformUser &&
          !log.platformUser?.email
            .toLowerCase()
            .includes(platformUser.trim().toLowerCase())
        ) {
          return false;
        }
        if (dateFrom && createdAt < new Date(`${dateFrom}T00:00:00`)) {
          return false;
        }
        if (dateTo && createdAt > new Date(`${dateTo}T23:59:59.999`)) {
          return false;
        }
        if (companyTerm) {
          const searchable = [
            log.entityId,
            log.description,
            safeMetadata(log.metadataJson),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!searchable.includes(companyTerm)) return false;
        }
        return true;
      }),
    [action, company, dateFrom, dateTo, logs, platformUser],
  );

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Auditoria Platform" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className={`mt-6 ${platformPanelClass}`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setAction(event.target.value)}
              value={action}
            >
              <option value="">Todas las acciones</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Empresa o entidad"
              value={company}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setPlatformUser(event.target.value)}
              placeholder="Usuario platform"
              value={platformUser}
            />
            <input
              aria-label="Fecha desde"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
            <input
              aria-label="Fecha hasta"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Mostrando {filtered.length} de {logs.length} eventos. Los filtros se
            aplican sobre los ultimos 100 registros entregados por el backend.
          </p>
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-slate-600">Cargando auditoria...</p>
            ) : filtered.length ? (
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
                  {filtered.map((log) => (
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

function safeMetadata(value: unknown) {
  if (!value) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
