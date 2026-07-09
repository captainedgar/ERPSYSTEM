'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  enableMockProvider,
  getFiscalSettings,
  listFiscalProviders,
  testFiscalProviderConnection,
  updateFiscalSettings,
  type FiscalProvider,
  type FiscalSettings,
} from '@/lib/fiscal';

export function FiscalSettingsForm() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [providers, setProviders] = useState<FiscalProvider[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canConfigure = ['OWNER', 'ADMIN', 'ACCOUNTING'].includes(
    user?.role.code ?? '',
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canConfigure) return;
    let cancelled = false;
    async function load() {
      try {
        const [nextSettings, nextProviders] = await Promise.all([
          getFiscalSettings(),
          listFiscalProviders(),
        ]);
        if (!cancelled) {
          setSettings(nextSettings);
          setProviders(nextProviders);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar fiscal',
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
  }, [canConfigure, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      setSettings(await updateFiscalSettings(settings));
      setMessage('Configuracion fiscal guardada en sandbox/mock.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function enableMock() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await enableMockProvider();
      const [nextSettings, nextProviders] = await Promise.all([
        getFiscalSettings(),
        listFiscalProviders(),
      ]);
      setSettings(nextSettings);
      setProviders(nextProviders);
      setMessage('Proveedor mock habilitado.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo habilitar mock',
      );
    } finally {
      setSaving(false);
    }
  }

  async function test(providerId: string) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await testFiscalProviderConnection(providerId);
      setMessage('Conexion mock probada correctamente.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Prueba fallida');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (canConfigure && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando fiscal...
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Redirigiendo...
      </main>
    );
  }
  if (!canConfigure) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        No tienes permiso para configurar fiscal.
      </main>
    );
  }
  if (!settings) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        {error || 'No se encontro configuracion fiscal'}
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Fiscal sandbox
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Configuracion fiscal
            </h1>
            <p className="mt-2 text-slate-400">
              Ambiente {settings.environment} con proveedor{' '}
              {settings.providerMode}.
            </p>
          </div>
          <Link
            className="text-sm text-slate-300"
            href="/fiscal/electronic-invoices"
          >
            Ver documentos fiscales
          </Link>
        </header>

        {(error || message) && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm ${
              error
                ? 'border-rose-900 bg-rose-950/30 text-rose-200'
                : 'border-emerald-900 bg-emerald-950/30 text-emerald-200'
            }`}
          >
            {error || message}
          </div>
        )}

        <form
          className="mt-6 grid gap-4 rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:grid-cols-2"
          onSubmit={(event) => void submit(event)}
        >
          <Field
            label="RNC"
            value={settings.rnc ?? ''}
            onChange={(rnc) => setSettings({ ...settings, rnc })}
          />
          <Field
            label="Razon social"
            value={settings.legalName ?? ''}
            onChange={(legalName) => setSettings({ ...settings, legalName })}
          />
          <Field
            label="Nombre comercial"
            value={settings.commercialName ?? ''}
            onChange={(commercialName) =>
              setSettings({ ...settings, commercialName })
            }
          />
          <Field
            label="Actividad economica"
            value={settings.economicActivity ?? ''}
            onChange={(economicActivity) =>
              setSettings({ ...settings, economicActivity })
            }
          />
          <Field
            label="Direccion fiscal"
            value={settings.fiscalAddress ?? ''}
            onChange={(fiscalAddress) =>
              setSettings({ ...settings, fiscalAddress })
            }
          />
          <Field
            label="Provincia"
            value={settings.province ?? ''}
            onChange={(province) => setSettings({ ...settings, province })}
          />
          <Field
            label="Municipio"
            value={settings.municipality ?? ''}
            onChange={(municipality) =>
              setSettings({ ...settings, municipality })
            }
          />
          <label className="flex items-center gap-3 pt-6">
            <input
              checked={settings.enabled}
              type="checkbox"
              onChange={(event) =>
                setSettings({ ...settings, enabled: event.target.checked })
              }
            />
            Fiscal sandbox activo
          </label>
          <div className="sm:col-span-2">
            <Button disabled={saving} type="submit">
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </Button>
          </div>
        </form>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Proveedor mock</h2>
              <p className="mt-1 text-sm text-slate-400">
                Simulacion local sin DGII, credenciales reales ni firma digital.
              </p>
            </div>
            <Button
              disabled={saving}
              onClick={() => void enableMock()}
              type="button"
              variant="secondary"
            >
              Habilitar mock
            </Button>
          </div>
          <div className="mt-4 grid gap-3">
            {providers.map((provider) => (
              <article
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={provider.id}
              >
                <div>
                  <p className="font-medium">{provider.name}</p>
                  <p className="text-sm text-slate-400">
                    {provider.code} · {provider.mode} · {provider.status}
                  </p>
                </div>
                <Button
                  disabled={saving}
                  onClick={() => void test(provider.id)}
                  type="button"
                  variant="secondary"
                >
                  Probar conexion
                </Button>
              </article>
            ))}
            {!providers.length && (
              <p className="py-6 text-center text-slate-500">
                No hay proveedor mock habilitado.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
