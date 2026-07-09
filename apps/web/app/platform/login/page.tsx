'use client';

import { Button } from '@comercia/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { platformLogin, storePlatformToken } from '@/lib/platform';

const inputClass =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default function PlatformLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setSubmitting(true);
    try {
      const email = form.get('email');
      const password = form.get('password');
      const response = await platformLogin(
        typeof email === 'string' ? email : '',
        typeof password === 'string' ? password : '',
      );
      storePlatformToken(response.accessToken);
      router.push('/platform/dashboard');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo iniciar sesion',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-12">
      <form
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-950/20"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-sm font-semibold text-blue-700">Comercia ERP</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Platform Admin
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Acceso global separado para administracion SaaS.
        </p>
        <div className="mt-8 grid gap-5">
          <label className="text-sm font-medium text-slate-700">
            Correo
            <input
              autoComplete="email"
              className={inputClass}
              name="email"
              placeholder="admin@comercia.local"
              required
              type="email"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Contrasena
            <input
              autoComplete="current-password"
              className={inputClass}
              minLength={8}
              name="password"
              placeholder="Tu contrasena"
              required
              type="password"
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <Button className="mt-7 w-full" disabled={submitting} type="submit">
          {submitting ? 'Ingresando...' : 'Entrar'}
        </Button>
      </form>
    </main>
  );
}
