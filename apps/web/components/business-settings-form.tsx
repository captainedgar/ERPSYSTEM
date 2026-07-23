'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { mediaUrl } from '@/lib/media';
import { hasPermission } from '@/lib/permissions';
import {
  applyBusinessTemplate,
  BusinessType,
  completeBusinessOnboarding,
  Currency,
  DocumentType,
  getBusinessSettings,
  getBusinessTemplates,
  getCompanyLogo,
  PaymentMethod,
  updateBusinessSettings,
  uploadCompanyLogo,
  deleteCompanyLogo,
  type BusinessSettings,
  type BusinessTemplateDefinition,
  type CompanyLogo,
} from '@/lib/business-settings';

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
};

const documentLabels: Record<DocumentType, string> = {
  INTERNAL_RECEIPT: 'Recibo interno',
  CONSUMER_INVOICE: 'Factura de consumo',
  FISCAL_INVOICE: 'Factura fiscal',
};

export function BusinessSettingsForm({
  onboarding = false,
}: {
  onboarding?: boolean;
}) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [templates, setTemplates] = useState<BusinessTemplateDefinition[]>([]);
  const [companyLogo, setCompanyLogo] = useState<CompanyLogo | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      getBusinessSettings(),
      getBusinessTemplates(),
      getCompanyLogo(),
    ])
      .then(([current, availableTemplates, currentLogo]) => {
        setSettings(current);
        setTemplates(availableTemplates);
        setCompanyLogo(currentLogo);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo cargar la configuración',
        );
      })
      .finally(() => setLoading(false));
  }, [user]);

  function change<K extends keyof BusinessSettings>(
    field: K,
    value: BusinessSettings[K],
  ) {
    setSettings((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  function togglePayment(method: PaymentMethod) {
    if (!settings) return;
    const enabled = settings.enabledPaymentMethods.includes(method)
      ? settings.enabledPaymentMethods.filter((value) => value !== method)
      : [...settings.enabledPaymentMethods, method];
    if (!enabled.length) return;
    change('enabledPaymentMethods', enabled);
    if (!enabled.includes(settings.defaultPaymentMethod)) {
      change('defaultPaymentMethod', enabled[0] ?? PaymentMethod.CASH);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    await runAction(async () => {
      const updated = await updateBusinessSettings({
        businessType: settings.businessType,
        currency: settings.currency,
        taxRate: Number(settings.taxRate),
        allowNegativeStock: settings.allowNegativeStock,
        requireOpenCashForSales: settings.requireOpenCashForSales,
        defaultDocumentType: settings.defaultDocumentType,
        defaultPaymentMethod: settings.defaultPaymentMethod,
        enabledPaymentMethods: settings.enabledPaymentMethods,
        receiptFooterText: settings.receiptFooterText,
        printLogo: settings.printLogo,
        posQuickSaleMode: settings.posQuickSaleMode,
        posShowStock: settings.posShowStock,
        posAllowDiscounts: settings.posAllowDiscounts,
        cashRequireOpeningAmount: settings.cashRequireOpeningAmount,
        cashAllowExpenses: settings.cashAllowExpenses,
      });
      setSettings(updated);
      return 'Configuración guardada.';
    });
  }

  async function applyTemplate() {
    if (!settings) return;
    await runAction(async () => {
      const updated = await applyBusinessTemplate(settings.businessType);
      setSettings(updated);
      return 'Plantilla aplicada. Puedes ajustar sus valores antes de guardar.';
    });
  }

  async function completeOnboarding() {
    await runAction(async () => {
      const updated = await completeBusinessOnboarding();
      setSettings(updated);
      return 'Configuración inicial completada.';
    });
  }

  async function runAction(action: () => Promise<string>) {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      setMessage(await action());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeLogo(file?: File) {
    if (!file) return;
    setUploadingLogo(true);
    await runAction(async () => {
      setCompanyLogo(await uploadCompanyLogo(file));
      return 'Logo empresarial actualizado.';
    });
    setUploadingLogo(false);
  }

  async function removeLogo() {
    await runAction(async () => {
      setCompanyLogo(await deleteCompanyLogo());
      return 'Logo empresarial eliminado.';
    });
  }

  if (authLoading || loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando…</main>
    );
  }

  if (!settings) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-rose-400">
            {error || 'No se encontró la configuración del negocio.'}
          </p>
          <Link className="mt-4 inline-block text-blue-600" href="/dashboard">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  const selectedTemplate = templates.find(
    ({ id }) => id === settings.businessType,
  );
  const administrationLinks = [
    {
      href: '/settings/users',
      label: 'Usuarios',
      description: 'Administra accesos, roles y sucursales asignadas.',
      visible: [
        'users.view',
        'users.create',
        'users.update',
        'users.disable',
      ].some((permission) => hasPermission(user, permission)),
    },
    {
      href: '/settings/branches',
      label: 'Sucursales',
      description: 'Configura locales y su disponibilidad operativa.',
      visible: hasPermission(user, 'branches.view'),
    },
    {
      href: '/settings/roles',
      label: 'Roles y permisos',
      description: 'Consulta los roles predefinidos y sus permisos efectivos.',
      visible: hasPermission(user, 'roles.view'),
    },
  ].filter(({ visible }) => visible);

  return (
    <main className="min-h-screen px-6 py-8">
      <form
        className="mx-auto max-w-5xl"
        onSubmit={(event) => void save(event)}
      >
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Comercia ERP</p>
            <h1 className="mt-1 text-3xl font-semibold">
              {onboarding
                ? 'Configuración inicial'
                : 'Configuración del negocio'}
            </h1>
            <p className="mt-2 text-slate-500">
              Define preferencias que usarán los módulos operativos futuros.
            </p>
          </div>
          <Link
            className="text-sm text-slate-600 hover:text-slate-950"
            href="/dashboard"
          >
            Volver al panel
          </Link>
        </header>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Negocio y plantilla</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label>
              Tipo de negocio
              <select
                value={settings.businessType}
                onChange={(event) =>
                  change('businessType', event.target.value as BusinessType)
                }
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>{selectedTemplate?.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Preparado para:{' '}
                {selectedTemplate?.futureCapabilities.join(', ')}
              </p>
            </div>
          </div>
          <Button
            className="mt-5"
            disabled={submitting}
            onClick={() => void applyTemplate()}
            type="button"
            variant="secondary"
          >
            Aplicar plantilla recomendada
          </Button>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Branding de la empresa</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usa PNG, JPG o WebP de hasta 2 MB. Recomendamos 512x512 y fondo
            transparente.
          </p>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {companyLogo?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`Logo de ${companyLogo.name}`}
                  className="h-full w-full object-contain p-2"
                  src={mediaUrl(companyLogo.logoUrl) ?? undefined}
                />
              ) : (
                <span className="text-sm text-slate-500">Sin logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {hasPermission(user, 'companies.update') && (
                <>
                  <label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={uploadingLogo}
                      onChange={(event) =>
                        void changeLogo(event.target.files?.[0])
                      }
                      type="file"
                    />
                  </label>
                  {companyLogo?.logoUrl && (
                    <Button
                      onClick={() => void removeLogo()}
                      type="button"
                      variant="secondary"
                    >
                      Eliminar logo
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {administrationLinks.length > 0 && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold">
              Administracion de la empresa
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Accesos disponibles segun tus permisos efectivos.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {administrationLinks.map(({ description, href, label }) => (
                <Link
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50"
                  href={href}
                  key={href}
                >
                  <span className="font-semibold text-slate-950">{label}</span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {description}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Impuestos y documentos</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <label>
              Moneda
              <select
                value={settings.currency}
                onChange={(event) =>
                  change('currency', event.target.value as Currency)
                }
              >
                <option value={Currency.DOP}>DOP — Peso dominicano</option>
              </select>
            </label>
            <label>
              ITBIS por defecto (%)
              <input
                max="100"
                min="0"
                step="0.01"
                type="number"
                value={Number(settings.taxRate)}
                onChange={(event) => change('taxRate', event.target.value)}
              />
            </label>
            <label>
              Documento por defecto
              <select
                value={settings.defaultDocumentType}
                onChange={(event) =>
                  change(
                    'defaultDocumentType',
                    event.target.value as DocumentType,
                  )
                }
              >
                {Object.values(DocumentType).map((value) => (
                  <option key={value} value={value}>
                    {documentLabels[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Métodos de pago</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {Object.values(PaymentMethod).map((method) => (
              <Checkbox
                checked={settings.enabledPaymentMethods.includes(method)}
                key={method}
                label={paymentLabels[method]}
                onChange={() => togglePayment(method)}
              />
            ))}
          </div>
          <label className="mt-5 max-w-sm">
            Método por defecto
            <select
              value={settings.defaultPaymentMethod}
              onChange={(event) =>
                change(
                  'defaultPaymentMethod',
                  event.target.value as PaymentMethod,
                )
              }
            >
              {settings.enabledPaymentMethods.map((method) => (
                <option key={method} value={method}>
                  {paymentLabels[method]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <PreferenceGroup
            title="Caja"
            values={[
              [
                'Requerir caja abierta para vender',
                settings.requireOpenCashForSales,
                (value) => change('requireOpenCashForSales', value),
              ],
              [
                'Requerir monto de apertura',
                settings.cashRequireOpeningAmount,
                (value) => change('cashRequireOpeningAmount', value),
              ],
              [
                'Permitir gastos de caja',
                settings.cashAllowExpenses,
                (value) => change('cashAllowExpenses', value),
              ],
            ]}
          />
          <PreferenceGroup
            title="POS e inventario futuro"
            values={[
              [
                'Modo de venta rápida',
                settings.posQuickSaleMode,
                (value) => change('posQuickSaleMode', value),
              ],
              [
                'Mostrar stock',
                settings.posShowStock,
                (value) => change('posShowStock', value),
              ],
              [
                'Permitir descuentos',
                settings.posAllowDiscounts,
                (value) => change('posAllowDiscounts', value),
              ],
              [
                'Permitir stock negativo',
                settings.allowNegativeStock,
                (value) => change('allowNegativeStock', value),
              ],
            ]}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Recibo e impresión</h2>
          <div className="mt-5 grid gap-5">
            <Checkbox
              checked={settings.printLogo}
              label="Imprimir logo cuando esté disponible"
              onChange={() => change('printLogo', !settings.printLogo)}
            />
            <label>
              Pie del recibo
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                maxLength={500}
                value={settings.receiptFooterText ?? ''}
                onChange={(event) =>
                  change('receiptFooterText', event.target.value)
                }
              />
            </label>
          </div>
        </section>

        {error && <p className="mt-5 text-sm text-rose-400">{error}</p>}
        {message && <p className="mt-5 text-sm text-blue-600">{message}</p>}

        <footer className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button disabled={submitting} type="submit">
            {submitting ? 'Guardando…' : 'Guardar configuración'}
          </Button>
          <Button
            disabled={submitting || settings.onboardingCompleted}
            onClick={() => void completeOnboarding()}
            type="button"
            variant="secondary"
          >
            {settings.onboardingCompleted
              ? 'Onboarding completado'
              : 'Completar onboarding'}
          </Button>
        </footer>
      </form>
    </main>
  );
}

function Checkbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer grid-cols-none items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <input checked={checked} onChange={onChange} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function PreferenceGroup({
  title,
  values,
}: {
  title: string;
  values: Array<[string, boolean, (value: boolean) => void]>;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-5 grid gap-3">
        {values.map(([label, checked, onChange]) => (
          <Checkbox
            checked={checked}
            key={label}
            label={label}
            onChange={() => onChange(!checked)}
          />
        ))}
      </div>
    </section>
  );
}
