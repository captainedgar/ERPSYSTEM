'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';
import { CompanyLogo } from '@/components/company-logo';
import { EmptyState, PageHeader, StatCard } from '@/components/ui-patterns';

export default function DashboardPage() {
  const router = useRouter();
  const { loading, logout, user } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando panel...
      </main>
    );
  }

  const canUsePos = ['OWNER', 'ADMIN', 'CASHIER', 'SELLER'].includes(
    user.role.code,
  );
  const canViewSales = [
    'OWNER',
    'ADMIN',
    'CASHIER',
    'SELLER',
    'ACCOUNTING',
  ].includes(user.role.code);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          actions={
            <>
              {canUsePos && (
                <Link
                  className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  href="/pos"
                >
                  Nueva venta
                </Link>
              )}
              <Button
                variant="secondary"
                onClick={() => void logout().then(() => router.push('/login'))}
              >
                Cerrar sesión
              </Button>
            </>
          }
          description="Vista ejecutiva para operar ventas, caja, inventario y documentos desde un solo lugar."
          eyebrow="Comercia ERP"
          title={`Hola, ${user.name}`}
        />

        <section className="mt-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <CompanyLogo
            logoUrl={user.company.logoUrl}
            name={user.company.name}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate text-2xl font-semibold text-slate-950">
              {user.company.name}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {businessTypeLabel(user.company.businessType)} /{' '}
              {user.branch?.name ?? 'Sucursal principal'}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ventas del día" value="Sin datos aún" />
          <StatCard label="Caja actual" value="Por abrir" tone="green" />
          <StatCard
            label="Stock bajo"
            value="Revisar inventario"
            tone="amber"
          />
          <StatCard label="Fiscal mock" value="Sandbox" tone="cyan" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="section-card p-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Accesos rápidos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Atajos seguros según tu rol actual.
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {canUsePos && <QuickAction href="/pos" title="Nueva venta" />}
              {canViewSales && <QuickAction href="/sales" title="Ver ventas" />}
              <QuickAction href="/catalog/products" title="Productos" />
              <QuickAction href="/inventory" title="Inventario" />
              {user.role.code !== 'WAREHOUSE' && (
                <QuickAction href="/customers" title="Clientes" />
              )}
              {['OWNER', 'ADMIN', 'ACCOUNTING'].includes(user.role.code) && (
                <QuickAction
                  href="/fiscal/settings"
                  title="Configurar fiscal"
                />
              )}
            </div>
          </div>

          <div className="section-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Sesión activa
            </h2>
            <div className="mt-5 grid gap-3">
              <Info label="Rol" value={user.role.name} />
              <Info
                label="Sucursal"
                value={user.branch?.name ?? 'Sin asignar'}
              />
              <Info label="Correo" value={user.email} />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="section-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Ventas recientes
            </h2>
            <div className="mt-5">
              <EmptyState title="Aún no hay actividad cargada">
                Registra ventas desde el POS para ver el resumen operativo aquí.
              </EmptyState>
            </div>
          </div>
          <div className="section-card p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Documentos pendientes
            </h2>
            <div className="mt-5">
              <EmptyState title="Sin documentos pendientes">
                Los recibos internos y documentos fiscales mock aparecerán al
                generarse.
              </EmptyState>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function QuickAction({ href, title }: { href: string; title: string }) {
  return (
    <Link
      className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      href={href}
    >
      {title}
    </Link>
  );
}

function businessTypeLabel(value: string) {
  return (
    {
      SMALL_STORE: 'Colmado o tienda',
      BEAUTY_SALON: 'Salon de belleza',
      BARBERSHOP: 'Barberia',
      MINIMARKET: 'Minimarket',
      GROCERY: 'Abarrotes',
      TIRE_SHOP: 'Gomera',
      AUTO_PARTS: 'Repuestos',
      HARDWARE_STORE: 'Ferreteria',
      CLOTHING_STORE: 'Tienda de ropa',
      PHONE_STORE: 'Telefonia',
      COSMETICS_STORE: 'Cosmeticos',
      SERVICE_BUSINESS: 'Servicios',
      OTHER: 'Negocio',
    }[value] ?? 'Negocio'
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </p>
      <p className="mt-1 font-medium text-slate-950">{value}</p>
    </div>
  );
}
