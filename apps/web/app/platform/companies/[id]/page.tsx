'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  PlatformHeader,
  PlatformMetricCard,
  PlatformStatusBadge,
  PlatformSubscriptionStatusBadge,
  platformErrorClass,
  platformErrorMessage,
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

  async function refresh() {
    setError('');
    const [nextCompany, nextMetrics, nextUsers, nextSubscription] =
      await Promise.all([
        getPlatformCompany(params.id),
        getPlatformCompanyMetrics(params.id),
        getPlatformCompanyUsers(params.id),
        getCompanySubscription(params.id),
      ]);
    setCompany(nextCompany);
    setMetrics(nextMetrics);
    setUsers(nextUsers);
    setSubscription(nextSubscription);
  }

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
        if (cancelled) return;
        setCompany(nextCompany);
        setMetrics(nextMetrics);
        setUsers(nextUsers);
        setSubscription(nextSubscription);
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudo cargar la empresa.', reason),
          );
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
      await updatePlatformCompanyStatus(params.id, status);
      await refresh();
    } catch (reason) {
      setError(
        platformErrorMessage('No se pudo actualizar la empresa.', reason),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!company && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        Cargando empresa...
      </main>
    );
  }

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title={company?.name ?? 'Empresa'} />
          {company && (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={submitting || company.status === 'SUSPENDED'}
                onClick={() => void changeStatus('SUSPENDED')}
                type="button"
                variant="secondary"
              >
                Suspender
              </Button>
              <Button
                disabled={submitting || company.status === 'ACTIVE'}
                onClick={() => void changeStatus('ACTIVE')}
                type="button"
              >
                Reactivar
              </Button>
              <Link
                className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                href={`/platform/companies/${company.id}/subscription`}
              >
                Administrar suscripcion
              </Link>
            </div>
          )}
        </div>
        {error && <p className={platformErrorClass}>{error}</p>}
        {company && (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PlatformMetricCard
                label="Usuarios"
                value={metrics?.users ?? 0}
              />
              <PlatformMetricCard
                label="Ventas"
                value={metrics?.totalSales ?? 0}
              />
              <PlatformMetricCard
                label="Total vendido"
                value={platformMoney(metrics?.totalSalesAmount)}
              />
              <PlatformMetricCard
                label="Documentos"
                value={metrics?.internalDocuments ?? 0}
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
              <div className={platformPanelClass}>
                <h2 className="text-lg font-semibold text-slate-950">
                  Datos de empresa
                </h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  <Info label="Nombre" value={company.name} />
                  <Info label="Email" value={company.email ?? 'N/D'} />
                  <Info
                    label="RNC/Cedula"
                    value={company.rncOrCedula ?? 'N/D'}
                  />
                  <Info label="Telefono" value={company.phone ?? 'N/D'} />
                  <Info label="Direccion" value={company.address ?? 'N/D'} />
                  <Info
                    label="Fecha de registro"
                    value={new Date(company.createdAt).toLocaleDateString(
                      'es-DO',
                    )}
                  />
                  <div>
                    <dt className="text-xs font-semibold text-slate-500 uppercase">
                      Estado
                    </dt>
                    <dd className="mt-1">
                      <PlatformStatusBadge status={company.status} />
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={platformPanelClass}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Suscripcion actual
                  </h2>
                  <Link
                    className={platformLinkClass}
                    href={`/platform/companies/${company.id}/subscription`}
                  >
                    Administrar
                  </Link>
                </div>
                {subscription ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Info label="Plan actual" value={subscription.plan.name} />
                    <div>
                      <dt className="text-xs font-semibold text-slate-500 uppercase">
                        Estado
                      </dt>
                      <dd className="mt-1">
                        <PlatformSubscriptionStatusBadge
                          status={subscription.status}
                        />
                      </dd>
                    </div>
                    <Info
                      label="Proximo pago"
                      value={formatDate(subscription.nextPaymentDueAt)}
                    />
                    <Info
                      label="Ultimo pago"
                      value={formatDate(subscription.lastPaymentAt)}
                    />
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    Esta empresa no tiene suscripcion asignada.
                  </p>
                )}
              </div>
            </section>

            <section className={`mt-6 ${platformPanelClass}`}>
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
            </section>
          </>
        )}
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
      <dd className="mt-1 text-slate-950">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/D';
  return new Date(value).toLocaleDateString('es-DO');
}
