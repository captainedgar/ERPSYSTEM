'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';

export default function DashboardPage() {
  const router = useRouter();
  const { loading, logout, user } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando…</main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Comercia ERP
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Panel principal</h1>
          </div>
          <Button
            variant="secondary"
            onClick={() => void logout().then(() => router.push('/login'))}
          >
            Cerrar sesión
          </Button>
        </header>

        <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-950 p-8">
          <p className="text-sm text-slate-400">Sesión activa</p>
          <h2 className="mt-2 text-3xl font-semibold">Hola, {user.name}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Info label="Rol" value={user.role.name} />
            <Info label="Sucursal" value={user.branch?.name ?? 'Sin asignar'} />
            <Info label="Correo" value={user.email} />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-slate-700 p-8 text-slate-400">
          La base segura del negocio está lista. Configura ahora las
          preferencias que usarán los módulos operativos futuros.
          <div className="mt-5">
            <Link
              className="font-semibold text-emerald-400 hover:text-emerald-300"
              href="/settings/business"
            >
              Configurar el negocio
            </Link>
            <span className="mx-3 text-slate-700">·</span>
            <Link
              className="font-semibold text-emerald-400 hover:text-emerald-300"
              href="/catalog/products"
            >
              Administrar catálogo
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5">
      <p className="text-xs tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}
