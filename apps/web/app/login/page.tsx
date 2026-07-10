'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth, type AuthUser } from '@/components/auth-provider';
import { apiRequest, type AuthTokens } from '@/lib/api';

interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

export default function LoginPage() {
  const router = useRouter();
  const { clearSessionMessage, sessionMessage, setSession } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(
    () => () => {
      clearSessionMessage();
    },
    [clearSessionMessage],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      const response = await apiRequest<LoginResponse>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: data.get('email'),
            password: data.get('password'),
          }),
        },
        false,
      );
      setSession(response.user, response);
      router.push(
        response.user.company.status === 'SUSPENDED'
          ? '/suspended'
          : '/dashboard',
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo iniciar sesión',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <form
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-sm font-semibold text-blue-600">Comercia ERP</p>
        <h1 className="mt-3 text-3xl font-semibold">Bienvenido de vuelta</h1>
        <p className="mt-2 text-slate-500">
          Accede a la administración de tu negocio.
        </p>
        {sessionMessage && (
          <p
            className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
            role="alert"
          >
            {sessionMessage}
          </p>
        )}
        <div className="mt-8 grid gap-5">
          <label>
            Correo electrónico
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
        <Button className="mt-7 w-full" disabled={submitting} type="submit">
          {submitting ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>
        <p className="mt-6 text-center text-sm text-slate-500">
          ¿Aún no tienes una empresa?{' '}
          <Link className="text-blue-600" href="/register">
            Regístrala
          </Link>
        </p>
      </form>
    </main>
  );
}
