'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  PlatformHeader,
  PlatformMetric,
  PlatformMetricCard,
  platformErrorClass,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  getCompanySubscription,
  getPlatformCompany,
  getPlatformCompanyMetrics,
  getPlatformCompanyUsers,
  updatePlatformCompanyStatus,
  type CompanySubscription,
  type PlatformCompany,
  type PlatformCompanyMetrics,
  type PlatformCompanyUser,
} from '@/lib/platform';

export default function PlatformCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<PlatformCompany | null>(null);
  const [metrics, setMetrics] = useState<PlatformCompanyMetrics | null>(null);
  const [subscription, setSubscription] = useState<CompanySubscription | null>(
    null,
  );
  const [users, setUsers] = useState<PlatformCompanyUser[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextCompany, nextMetrics, nextUsers, nextSubscription] =
          await Promise.all([
            getPlatformCompany(params.id),
            getPlatformCompanyMetrics(params.id),
            getPlatformCompanyUsers(params.id),
            getCompanySubscription(params.id),
          ]);
        if (!cancelled) {
          setCompany(nextCompany);
          setMetrics(nextMetrics);
          setUsers(nextUsers);
          setSubscription(nextSubscription);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Error');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function changeStatus(status: 'ACTIVE' | 'SUSPENDED') {
    setSubmitting(true);
    setError('');
    try {
      setCompany(await updatePlatformCompanyStatus(params.id, status));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!company) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        {error || 'Cargando empresa...'}
      </main>
    );
  }

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title={company.name} />
          <div className="flex gap-3">
            <Button
              disabled={submitting || company.status === 'SUSPENDED'}
              onClick={() => void changeStatus('SUSPENDED')}
              variant="secondary"
            >
              Suspender
            </Button>
            <Button
              disabled={submitting || company.status === 'ACTIVE'}
              onClick={() => void changeStatus('ACTIVE')}
            >
              Reactivar
            </Button>
          </div>
        </div>
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PlatformMetric label="Estado" value={company.status} />
          <PlatformMetric
            label="Usuarios"
            value={metrics?.users ?? users.length}
          />
          <PlatformMetric label="Ventas" value={metrics?.totalSales ?? 0} />
          <PlatformMetric
            label="Total vendido"
            value={platformMoney(metrics?.totalSalesAmount)}
          />
          <PlatformMetric
            label="Docs internos"
            value={metrics?.internalDocuments ?? 0}
          />
          <PlatformMetric
            label="Fiscal mock"
            value={metrics?.electronicInvoices ?? 0}
          />
          <PlatformMetric
            label="Errores fiscales"
            value={metrics?.fiscalErrors ?? 0}
          />
          <PlatformMetric label="Clientes" value={metrics?.customers ?? 0} />
        </section>
        <section className={`mt-6 ${platformPanelClass}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Suscripcion SaaS
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Plan actual, vencimiento y ultimo pago manual registrado.
              </p>
            </div>
            <Link
              className={platformLinkClass}
              href={`/platform/companies/${company.id}/subscription`}
            >
              Gestionar billing
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <PlatformMetricCard
              label="Plan"
              value={subscription?.plan.name ?? 'Sin plan'}
            />
            <PlatformMetricCard
              label="Estado"
              tone={subscription?.status === 'ACTIVE' ? 'emerald' : 'amber'}
              value={subscription?.status ?? 'N/D'}
            />
            <PlatformMetricCard
              label="Proximo pago"
              value={formatDate(subscription?.nextPaymentDueAt)}
            />
            <PlatformMetricCard
              label="Ultimo pago"
              value={formatDate(subscription?.lastPaymentAt)}
            />
          </div>
        </section>
        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className={platformPanelClass}>
            <h2 className="text-lg font-semibold text-slate-950">Detalle</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <Info label="Nombre legal" value={company.legalName ?? 'N/D'} />
              <Info label="RNC/Cedula" value={company.rncOrCedula ?? 'N/D'} />
              <Info label="Correo" value={company.email ?? 'N/D'} />
              <Info label="Telefono" value={company.phone ?? 'N/D'} />
              <Info label="Direccion" value={company.address ?? 'N/D'} />
              <Info label="Tipo" value={company.businessType} />
            </dl>
          </div>
          <div className={platformPanelClass}>
            <h2 className="text-lg font-semibold text-slate-950">
              Usuarios de empresa
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3">Usuario</th>
                    <th className="py-3">Rol</th>
                    <th className="py-3">Estado</th>
                    <th className="py-3">Sucursal</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      className="border-t border-slate-200 transition hover:bg-slate-50"
                      key={user.id}
                    >
                      <td className="py-3">
                        <p className="font-medium text-slate-950">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="py-3">{user.role.name}</td>
                      <td className="py-3">{user.status}</td>
                      <td className="py-3">{user.branch?.name ?? 'N/D'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/D';
  return new Date(value).toLocaleDateString('es-DO');
}
