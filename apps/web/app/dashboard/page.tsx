'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getStoredActiveBranchId } from '@/lib/api';
import { listAvailableBranches, type AvailableBranch } from '@/lib/branches';
import { hasPermission } from '@/lib/permissions';

export default function DashboardPage() {
  const router = useRouter();
  const { loading, logout, user } = useAuth();
  const [availableBranches, setAvailableBranches] = useState<AvailableBranch[]>(
    [],
  );
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user?.company.status === 'SUSPENDED') {
      router.replace('/suspended');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadBranches = async () => {
      const response = await listAvailableBranches();
      if (cancelled) return;
      setAvailableBranches(response.items);
      setActiveBranchId(
        getStoredActiveBranchId() ??
          response.activeBranchId ??
          response.defaultBranchId,
      );
    };
    void loadBranches().catch(() => {
      if (!cancelled) setAvailableBranches([]);
    });
    const onBranchChanged = () => {
      setActiveBranchId(getStoredActiveBranchId());
    };
    window.addEventListener('comercia:branch-changed', onBranchChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('comercia:branch-changed', onBranchChanged);
    };
  }, [user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Cargando panel...
      </main>
    );
  }

  const quickActions = [
    {
      href: '/pos',
      label: 'Abrir POS',
      description: 'Iniciar ventas desde caja o mostrador.',
      marker: 'PO',
      enabled: hasPermission(user, 'pos.access'),
    },
    {
      href: '/sales',
      label: 'Revisar ventas',
      description: 'Consultar documentos y actividad comercial.',
      marker: 'VE',
      enabled: hasPermission(user, 'sales.view'),
    },
    {
      href: '/cash',
      label: 'Control de caja',
      description: 'Ver movimientos y cierres operativos.',
      marker: 'CJ',
      enabled: hasPermission(user, 'cash.view'),
    },
    {
      href: '/customers',
      label: 'Clientes',
      description: 'Administrar contactos comerciales.',
      marker: 'CL',
      enabled: hasPermission(user, 'customers.view'),
    },
    {
      href: '/catalog/products',
      label: 'Catalogo',
      description: 'Mantener productos y precios al dia.',
      marker: 'CA',
      enabled: hasPermission(user, 'products.view'),
    },
    {
      href: '/inventory',
      label: 'Inventario',
      description: 'Supervisar existencias y disponibilidad.',
      marker: 'IN',
      enabled: hasPermission(user, 'inventory.view'),
    },
  ].filter((action) => action.enabled);

  const activeBranch =
    availableBranches.find((branch) => branch.id === activeBranchId) ??
    availableBranches.find((branch) => branch.id === user.branch?.id) ??
    null;
  const canManageBranches = hasPermission(user, 'branches.update');

  const metrics = [
    {
      label: 'Empresa',
      value: user.company.name,
      detail: user.company.status === 'ACTIVE' ? 'Activa' : user.company.status,
    },
    {
      label: 'Sucursal',
      value: activeBranch?.name ?? user.branch?.name ?? 'Sin asignar',
      detail: activeBranch?.isMain ? 'Principal activa' : 'Contexto operativo',
    },
    {
      label: 'Rol',
      value: user.role.name,
      detail: user.email,
    },
    {
      label: 'Modulos visibles',
      value: String(quickActions.length),
      detail: 'Segun permisos actuales',
    },
  ];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              Dashboard administrativo
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Panel principal
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Vista central para operar la empresa, entrar a los modulos clave y
              mantener el contexto de sesion siempre visible.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
              href="/settings/business"
            >
              Configuracion
            </Link>
            {canManageBranches && (
              <Link
                className="inline-flex h-10 items-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
                href="/settings/branches"
              >
                Sucursales
              </Link>
            )}
            <Button
              variant="secondary"
              onClick={() => void logout().then(() => router.push('/login'))}
            >
              Cerrar sesion
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              detail={metric.detail}
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-100 pb-4">
              <h2 className="text-base font-semibold text-slate-950">
                Accesos operativos
              </h2>
              <p className="text-sm text-slate-500">
                Atajos disponibles para tu rol actual.
              </p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {quickActions.map((action) => (
                <Link
                  className="group rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white hover:shadow-sm"
                  href={action.href}
                  key={action.href}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700 group-hover:bg-blue-600 group-hover:text-white">
                      {action.marker}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">
                        {action.label}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-500">
                        {action.description}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <aside className="grid gap-6">
            <Panel title="Sesion activa">
              <div className="space-y-4">
                <InfoRow label="Usuario" value={user.name} />
                <InfoRow label="Correo" value={user.email} />
                <InfoRow label="Rol" value={user.role.name} />
              </div>
            </Panel>

            <Panel title="Estado del dia">
              <div className="space-y-3">
                <StatusItem label="Empresa" status="Lista" tone="success" />
                <StatusItem
                  label="Sucursal activa"
                  status={activeBranch ? 'Seleccionada' : 'Asignada'}
                  tone="success"
                />
                <StatusItem
                  label="Configuracion"
                  status="Revisar"
                  tone="info"
                />
              </div>
            </Panel>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel title="Flujo recomendado">
            <ol className="space-y-3 text-sm text-slate-600">
              <Step number="1" text="Configura datos del negocio y sucursal." />
              <Step number="2" text="Actualiza catalogo e inventario." />
              <Step
                number="3"
                text="Opera ventas, caja y seguimiento diario."
              />
            </ol>
          </Panel>

          <Panel title="Supervision">
            <div className="space-y-3 text-sm text-slate-600">
              <InfoRow label="Documentos" value="Disponibles por modulo" />
              <InfoRow label="Caja" value="Control operativo" />
              <InfoRow label="Ventas" value="Consulta centralizada" />
            </div>
          </Panel>

          <Panel title="Administracion">
            <div className="space-y-3 text-sm text-slate-600">
              <InfoRow label="Clientes" value="Base comercial" />
              <InfoRow label="Catalogo" value="Productos y precios" />
              <InfoRow label="Inventario" value="Existencias" />
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-3 truncate text-xl font-semibold text-slate-950">
        {value}
      </p>
      <p className="mt-2 truncate text-sm text-slate-500">{detail}</p>
    </article>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="truncate text-right text-sm font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function StatusItem({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: 'success' | 'info';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          tone === 'success'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-blue-50 text-blue-700'
        }`}
      >
        {status}
      </span>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {number}
      </span>
      <span className="pt-1">{text}</span>
    </li>
  );
}
