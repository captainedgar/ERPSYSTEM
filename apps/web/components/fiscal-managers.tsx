'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  checkElectronicInvoiceStatus,
  enableMockFiscalProvider,
  getElectronicInvoice,
  getFiscalSettings,
  listElectronicInvoiceErrors,
  listElectronicInvoiceEvents,
  listElectronicInvoices,
  listFiscalProviders,
  retryElectronicInvoice,
  sendElectronicInvoice,
  testFiscalProvider,
  updateFiscalSettings,
  type ElectronicInvoice,
  type ElectronicInvoiceEvent,
  type FiscalError,
  type FiscalProvider,
  type FiscalSettings,
  type MockFiscalOutcome,
} from '@/lib/fiscal';
import { hasPermission } from '@/lib/permissions';

const outcomes: Array<{ value: MockFiscalOutcome; label: string }> = [
  { value: 'ACCEPTED', label: 'Aceptar' },
  { value: 'REJECTED', label: 'Rechazar' },
  { value: 'FAILED', label: 'Fallar' },
  { value: 'PENDING', label: 'Pendiente' },
];

export function FiscalSettingsManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [providers, setProviders] = useState<FiscalProvider[]>([]);
  const [form, setForm] = useState({
    rnc: '',
    legalName: '',
    commercialName: '',
    economicActivity: '',
    fiscalAddress: '',
    province: '',
    municipality: '',
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'fiscal.settings.view');
  const canUpdate = hasPermission(user, 'fiscal.settings.update');
  const canConfigure = hasPermission(user, 'fiscal.providers.configure');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const [nextSettings, nextProviders] = await Promise.all([
          getFiscalSettings(),
          listFiscalProviders().catch(() => []),
        ]);
        if (cancelled) return;
        setSettings(nextSettings);
        setProviders(nextProviders);
        setForm({
          rnc: nextSettings.rnc ?? '',
          legalName: nextSettings.legalName ?? '',
          commercialName: nextSettings.commercialName ?? '',
          economicActivity: nextSettings.economicActivity ?? '',
          fiscalAddress: nextSettings.fiscalAddress ?? '',
          province: nextSettings.province ?? '',
          municipality: nextSettings.municipality ?? '',
          enabled: nextSettings.enabled,
        });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo cargar la informacion.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canView, user]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateFiscalSettings({
        ...form,
        environment: 'SANDBOX',
        providerMode: 'MOCK',
      });
      setSettings(updated);
      setMessage('Configuracion fiscal mock actualizada.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No tienes permiso para realizar esta accion.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function enableProvider() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const provider = await enableMockFiscalProvider();
      setProviders((current) => [
        provider,
        ...current.filter((item) => item.id !== provider.id),
      ]);
      setMessage('Proveedor fiscal mock habilitado.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No tienes permiso para realizar esta accion.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function testProvider(providerId: string) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await testFiscalProvider(providerId);
      setMessage(result.message ?? 'Conexion mock probada.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No tienes permiso para realizar esta accion.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canView) return <FiscalAccessDenied />;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <FiscalHeader title="Fiscal / e-CF mock" />
        <MockNotice />
        {error && <Alert tone="red" message={error} />}
        {message && <Alert tone="blue" message={message} />}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <form
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            onSubmit={(event) => void save(event)}
          >
            <h2 className="text-lg font-semibold text-slate-950">
              Configuracion fiscal mock
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label="RNC"
                value={form.rnc}
                onChange={(value) => setForm({ ...form, rnc: value })}
              />
              <Field
                label="Razon social"
                value={form.legalName}
                onChange={(value) => setForm({ ...form, legalName: value })}
              />
              <Field
                label="Nombre comercial"
                value={form.commercialName}
                onChange={(value) =>
                  setForm({ ...form, commercialName: value })
                }
              />
              <Field
                label="Actividad economica"
                value={form.economicActivity}
                onChange={(value) =>
                  setForm({ ...form, economicActivity: value })
                }
              />
              <Field
                label="Provincia"
                value={form.province}
                onChange={(value) => setForm({ ...form, province: value })}
              />
              <Field
                label="Municipio"
                value={form.municipality}
                onChange={(value) => setForm({ ...form, municipality: value })}
              />
              <label className="md:col-span-2">
                Direccion fiscal
                <textarea
                  className="mt-1 min-h-24"
                  value={form.fiscalAddress}
                  onChange={(event) =>
                    setForm({ ...form, fiscalAddress: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input
                  checked={form.enabled}
                  type="checkbox"
                  onChange={(event) =>
                    setForm({ ...form, enabled: event.target.checked })
                  }
                />
                Fiscal mock habilitado
              </label>
            </div>
            <Button
              className="mt-5"
              disabled={!canUpdate || saving}
              type="submit"
            >
              Guardar configuracion
            </Button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Proveedor</h2>
            <p className="mt-2 text-sm text-slate-600">
              Entorno: {settings?.environment ?? 'SANDBOX'} / modo{' '}
              {settings?.providerMode ?? 'MOCK'}
            </p>
            <Button
              className="mt-4 w-full"
              disabled={!canConfigure || saving}
              onClick={() => void enableProvider()}
              type="button"
            >
              Habilitar proveedor mock
            </Button>
            <div className="mt-4 grid gap-3">
              {providers.map((provider) => (
                <article
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  key={provider.id}
                >
                  <p className="font-semibold text-slate-950">
                    {provider.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {provider.code} / {provider.status}
                  </p>
                  <Button
                    className="mt-3"
                    disabled={!canConfigure || saving}
                    onClick={() => void testProvider(provider.id)}
                    type="button"
                    variant="secondary"
                  >
                    Probar conexion
                  </Button>
                </article>
              ))}
              {!providers.length && (
                <p className="text-sm text-slate-500">
                  No hay datos disponibles.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export function FiscalInvoicesManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<ElectronicInvoice[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'fiscal.documents.view');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    void load();
    // The list reloads from explicit filter state and user context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, user]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const response = await listElectronicInvoices(params);
      setItems(response.items);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar la informacion.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canView) return <FiscalAccessDenied />;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FiscalHeader title="e-CF mock" />
        <MockNotice />
        {error && <Alert tone="red" message={error} />}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            className="grid gap-3 md:grid-cols-[1fr_220px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <input
              placeholder="Buscar por NCF, tracking, venta, documento o cliente"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              {[
                'DRAFT',
                'PENDING_PROVIDER',
                'SENT',
                'ACCEPTED',
                'REJECTED',
                'FAILED',
                'CANCELLED',
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
        </section>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {item.fiscalNumber ?? item.documentType}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.sale?.saleNumber ??
                        item.internalDocument?.documentNumber ??
                        'Borrador'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.customer?.name ?? 'Consumidor final'}
                    </td>
                    <td className="px-4 py-3">
                      <FiscalStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="font-semibold text-blue-700"
                        href={`/fiscal/electronic-invoices/${item.id}`}
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-slate-500"
                      colSpan={6}
                    >
                      No hay datos disponibles.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export function FiscalInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [invoice, setInvoice] = useState<ElectronicInvoice | null>(null);
  const [events, setEvents] = useState<ElectronicInvoiceEvent[]>([]);
  const [errors, setErrors] = useState<FiscalError[]>([]);
  const [outcome, setOutcome] = useState<MockFiscalOutcome>('ACCEPTED');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'fiscal.documents.view');
  const canSend = hasPermission(user, 'fiscal.documents.send');
  const canRetry = hasPermission(user, 'fiscal.documents.retry');
  const canEvents = hasPermission(user, 'fiscal.documents.view_events');
  const canErrors = hasPermission(user, 'fiscal.documents.view_errors');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    void load();
    // The invoice id and permission state define the request set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, invoiceId, user]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [nextInvoice, nextEvents, nextErrors] = await Promise.all([
        getElectronicInvoice(invoiceId),
        canEvents
          ? listElectronicInvoiceEvents(invoiceId)
          : Promise.resolve([]),
        canErrors
          ? listElectronicInvoiceErrors(invoiceId)
          : Promise.resolve([]),
      ]);
      setInvoice(nextInvoice);
      setEvents(nextEvents);
      setErrors(nextErrors);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar la informacion.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function run(action: 'send' | 'retry' | 'status') {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated =
        action === 'send'
          ? await sendElectronicInvoice(invoiceId, outcome)
          : action === 'retry'
            ? await retryElectronicInvoice(invoiceId, outcome)
            : await checkElectronicInvoiceStatus(invoiceId);
      setInvoice(updated);
      await load();
      setMessage('Accion fiscal mock completada.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No tienes permiso para realizar esta accion.',
      );
    } finally {
      setSaving(false);
    }
  }

  const canSendCurrent = useMemo(
    () =>
      invoice
        ? ['DRAFT', 'FAILED', 'REJECTED'].includes(invoice.status)
        : false,
    [invoice],
  );
  const canRetryCurrent = useMemo(
    () => (invoice ? ['FAILED', 'REJECTED'].includes(invoice.status) : false),
    [invoice],
  );

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canView) return <FiscalAccessDenied />;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <FiscalHeader title="Detalle e-CF mock" />
        <MockNotice />
        {error && <Alert tone="red" message={error} />}
        {message && <Alert tone="blue" message={message} />}
        {!invoice ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No hay datos disponibles.
          </section>
        ) : (
          <div className="mt-6 grid gap-6">
            <section className="grid gap-4 md:grid-cols-4">
              <InfoCard label="Tipo" value={invoice.documentType} />
              <InfoCard label="Estado" value={invoice.status} />
              <InfoCard
                label="NCF mock"
                value={invoice.fiscalNumber ?? 'N/D'}
              />
              <InfoCard
                label="Tracking"
                value={invoice.providerTrackId ?? 'N/D'}
              />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Acciones mock
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Origen:{' '}
                    {invoice.sale?.saleNumber ??
                      invoice.internalDocument?.documentNumber ??
                      'Borrador'}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[180px_auto_auto_auto]">
                  <select
                    value={outcome}
                    onChange={(event) =>
                      setOutcome(event.target.value as MockFiscalOutcome)
                    }
                  >
                    {outcomes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!canSend || !canSendCurrent || saving}
                    onClick={() => void run('send')}
                    type="button"
                  >
                    Enviar
                  </Button>
                  <Button
                    disabled={!canRetry || !canRetryCurrent || saving}
                    onClick={() => void run('retry')}
                    type="button"
                    variant="secondary"
                  >
                    Reintentar
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => void run('status')}
                    type="button"
                    variant="secondary"
                  >
                    Estado
                  </Button>
                </div>
              </div>
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <Timeline title="Eventos" items={events} />
              <ErrorsPanel errors={errors} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function FiscalHeader({ title }: { title: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          Fiscal mock
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      </div>
      <div className="flex gap-3 text-sm font-semibold">
        <Link className="text-blue-700" href="/fiscal/settings">
          Configuracion
        </Link>
        <Link className="text-blue-700" href="/fiscal/electronic-invoices">
          e-CF mock
        </Link>
      </div>
    </header>
  );
}

function MockNotice() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
      Ambiente mock. No valido para facturacion electronica real.
    </div>
  );
}

function Alert({ message, tone }: { message: string; tone: 'blue' | 'red' }) {
  return (
    <div
      className={`mt-5 rounded-lg border p-4 text-sm font-medium ${
        tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {message}
    </div>
  );
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        className="mt-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FiscalStatusBadge({ status }: { status: string }) {
  const tone = ['ACCEPTED', 'SENT'].includes(status)
    ? 'bg-emerald-50 text-emerald-700'
    : ['FAILED', 'REJECTED'].includes(status)
      ? 'bg-red-50 text-red-700'
      : 'bg-amber-50 text-amber-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </article>
  );
}

function Timeline({
  items,
  title,
}: {
  items: ElectronicInvoiceEvent[];
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            key={item.id}
          >
            <p className="font-semibold text-slate-950">{item.eventType}</p>
            <p className="mt-1 text-sm text-slate-600">{item.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </article>
        ))}
        {!items.length && (
          <p className="text-sm text-slate-500">No hay datos disponibles.</p>
        )}
      </div>
    </section>
  );
}

function ErrorsPanel({ errors }: { errors: FiscalError[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Errores</h2>
      <div className="mt-4 grid gap-3">
        {errors.map((item) => (
          <article
            className="rounded-xl border border-red-100 bg-red-50 p-4"
            key={item.id}
          >
            <p className="font-semibold text-red-800">{item.code}</p>
            <p className="mt-1 text-sm text-red-700">{item.message}</p>
          </article>
        ))}
        {!errors.length && (
          <p className="text-sm text-slate-500">No hay datos disponibles.</p>
        )}
      </div>
    </section>
  );
}

function FiscalAccessDenied() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Fiscal mock</h1>
        <p className="mt-2 text-sm text-slate-600">
          No tienes permiso para realizar esta accion.
        </p>
      </div>
    </main>
  );
}
