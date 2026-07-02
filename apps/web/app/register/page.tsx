'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { useAuth, type AuthUser } from '@/components/auth-provider';
import { apiRequest, type AuthTokens } from '@/lib/api';

interface RegisterResponse extends AuthTokens {
  user: AuthUser;
}

const businessTypes = [
  ['SMALL_STORE', 'Tienda pequeña'],
  ['BEAUTY_SALON', 'Salón de belleza'],
  ['BARBERSHOP', 'Barbería'],
  ['MINIMARKET', 'Minimarket'],
  ['GROCERY', 'Colmado'],
  ['TIRE_SHOP', 'Gomera'],
  ['AUTO_PARTS', 'Repuestos'],
  ['HARDWARE_STORE', 'Ferretería'],
  ['CLOTHING_STORE', 'Tienda de ropa'],
  ['PHONE_STORE', 'Tienda de celulares'],
  ['COSMETICS_STORE', 'Tienda de cosméticos'],
  ['SERVICE_BUSINESS', 'Negocio de servicios'],
  ['OTHER', 'Otro'],
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const optional = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value.trim() || undefined : undefined;
    };
    try {
      const response = await apiRequest<RegisterResponse>(
        '/auth/register-company',
        {
          method: 'POST',
          body: JSON.stringify({
            companyName: data.get('companyName'),
            legalName: optional('legalName'),
            rncOrCedula: optional('rncOrCedula'),
            companyPhone: optional('companyPhone'),
            companyEmail: optional('companyEmail'),
            address: optional('address'),
            businessType: data.get('businessType'),
            ownerName: data.get('ownerName'),
            ownerEmail: data.get('ownerEmail'),
            password: data.get('password'),
          }),
        },
        false,
      );
      setSession(response.user, response);
      router.push('/dashboard');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo registrar la empresa',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <form
        className="rounded-3xl border border-slate-800 bg-slate-950 p-8"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-sm font-semibold text-emerald-400">Comercia ERP</p>
        <h1 className="mt-3 text-3xl font-semibold">Registra tu empresa</h1>
        <p className="mt-2 text-slate-400">
          Crearemos la sucursal principal y tu usuario propietario.
        </p>

        <h2 className="mt-9 border-b border-slate-800 pb-3 font-semibold">
          Datos del negocio
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label>
            Nombre comercial
            <input name="companyName" minLength={2} required />
          </label>
          <label>
            Tipo de negocio
            <select name="businessType" required>
              {businessTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Razón social (opcional)
            <input name="legalName" />
          </label>
          <label>
            RNC o cédula (opcional)
            <input name="rncOrCedula" />
          </label>
          <label>
            Teléfono (opcional)
            <input name="companyPhone" />
          </label>
          <label>
            Correo del negocio (opcional)
            <input name="companyEmail" type="email" />
          </label>
          <label className="sm:col-span-2">
            Dirección (opcional)
            <input name="address" />
          </label>
        </div>

        <h2 className="mt-9 border-b border-slate-800 pb-3 font-semibold">
          Usuario propietario
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label>
            Nombre completo
            <input name="ownerName" minLength={2} required />
          </label>
          <label>
            Correo de acceso
            <input name="ownerEmail" type="email" required />
          </label>
          <label className="sm:col-span-2">
            Contraseña
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        {error && <p className="mt-5 text-sm text-rose-400">{error}</p>}
        <Button className="mt-7 w-full" disabled={submitting} type="submit">
          {submitting ? 'Creando empresa…' : 'Crear empresa'}
        </Button>
        <p className="mt-6 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link className="text-emerald-400" href="/login">
            Inicia sesión
          </Link>
        </p>
      </form>
    </main>
  );
}
