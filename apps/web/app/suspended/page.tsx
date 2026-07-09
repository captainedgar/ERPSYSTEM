'use client';

import { Button } from '@comercia/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth-provider';

export default function SuspendedPage() {
  const router = useRouter();
  const { loading, logout, user } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && user.company.status !== 'SUSPENDED') {
      router.replace('/dashboard');
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-xl rounded-lg border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">
          Servicio suspendido
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Tu empresa esta suspendida por falta de pago.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Contacta soporte o realiza el pago correspondiente para reactivar el
          servicio. Tus datos permanecen protegidos y no han sido eliminados.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{user.company.name}</p>
          <p className="mt-1">Estado: {user.company.status}</p>
          <p className="mt-1">Correo de usuario: {user.email}</p>
        </div>
        <Button
          className="mt-6"
          variant="secondary"
          onClick={() => void logout().then(() => router.push('/login'))}
        >
          Cerrar sesion
        </Button>
      </section>
    </main>
  );
}
