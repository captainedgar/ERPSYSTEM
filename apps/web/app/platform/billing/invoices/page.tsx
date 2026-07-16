'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  PlatformHeader,
  PlatformInvoiceStatusBadge,
  platformErrorClass,
  platformErrorMessage,
  platformInputClass,
  platformLabelClass,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import { canManageBilling, usePlatformUser } from '@/components/platform-shell';
import {
  createSubscriptionInvoice,
  listBillingSubscriptions,
  listSubscriptionInvoices,
  type CompanySubscription,
  type SubscriptionInvoice,
  type SubscriptionInvoiceStatus,
} from '@/lib/platform';

const statusFilters: Array<SubscriptionInvoiceStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOIDED',
];

export default function PlatformBillingInvoicesPage() {
  const platformUser = usePlatformUser();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [status, setStatus] = useState<SubscriptionInvoiceStatus | 'ALL'>(
    'ALL',
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subscriptionId: '',
    billingPeriodStart: todayInput(),
    billingPeriodEnd: nextMonthInput(),
    dueDate: nextMonthInput(),
    subtotal: '',
    taxAmount: '0',
    discountAmount: '0',
    notes: '',
  });

  async function refresh() {
    const [nextInvoices, nextSubscriptions] = await Promise.all([
      listSubscriptionInvoices(),
      listBillingSubscriptions(),
    ]);
    setInvoices(nextInvoices);
    setSubscriptions(nextSubscriptions);
    setForm((current) => ({
      ...current,
      subscriptionId: current.subscriptionId || nextSubscriptions[0]?.id || '',
    }));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextInvoices, nextSubscriptions] = await Promise.all([
          listSubscriptionInvoices(),
          listBillingSubscriptions(),
        ]);
        if (cancelled) return;
        setInvoices(nextInvoices);
        setSubscriptions(nextSubscriptions);
        setForm((current) => ({
          ...current,
          subscriptionId: nextSubscriptions[0]?.id ?? '',
        }));
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudieron cargar las facturas.', reason),
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
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subscription = subscriptions.find(
      (item) => item.id === form.subscriptionId,
    );
    if (!subscription) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const subtotal = form.subtotal
        ? Number(form.subtotal)
        : Number(subscription.plan.price);
      const taxAmount = Number(form.taxAmount || 0);
      const discountAmount = Number(form.discountAmount || 0);
      await createSubscriptionInvoice({
        companyId: subscription.companyId,
        companySubscriptionId: subscription.id,
        planId: subscription.planId,
        billingPeriodStart: form.billingPeriodStart,
        billingPeriodEnd: form.billingPeriodEnd,
        dueDate: form.dueDate,
        subtotal,
        taxAmount,
        discountAmount,
        total: subtotal + taxAmount - discountAmount,
        notes: form.notes || undefined,
      });
      setMessage('Factura interna creada correctamente.');
      await refresh();
    } catch (reason) {
      setError(platformErrorMessage('No se pudo crear la factura.', reason));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          (!companyId || invoice.companyId === companyId) &&
          (status === 'ALL' || invoice.status === status),
      ),
    [companyId, invoices, status],
  );

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Facturas SaaS" />
        {error && <p className={platformErrorClass}>{error}</p>}
        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}
        <section className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
          <form
            className={`${platformPanelClass} ${
              canManageBilling(platformUser) ? '' : 'hidden'
            }`}
            onSubmit={(event) => void submit(event)}
          >
            <h2 className="text-lg font-semibold text-slate-950">
              Generar factura
            </h2>
            <div className="mt-4 grid gap-3">
              <label className={platformLabelClass}>
                <span>Empresa suscrita</span>
                <select
                  className={platformInputClass}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      subscriptionId: event.target.value,
                    }))
                  }
                  value={form.subscriptionId}
                >
                  {subscriptions.map((subscription) => (
                    <option key={subscription.id} value={subscription.id}>
                      {subscription.company?.name ?? 'Empresa'} /{' '}
                      {subscription.plan.name}
                    </option>
                  ))}
                </select>
              </label>
              {!subscriptions.length && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                  No hay empresas con suscripcion para facturar.
                </p>
              )}
              <Field
                label="Inicio periodo"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    billingPeriodStart: value,
                  }))
                }
                type="date"
                value={form.billingPeriodStart}
              />
              <Field
                label="Fin periodo"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    billingPeriodEnd: value,
                  }))
                }
                type="date"
                value={form.billingPeriodEnd}
              />
              <Field
                label="Vence"
                onChange={(value) =>
                  setForm((current) => ({ ...current, dueDate: value }))
                }
                type="date"
                value={form.dueDate}
              />
              <Field
                label="Subtotal opcional"
                onChange={(value) =>
                  setForm((current) => ({ ...current, subtotal: value }))
                }
                type="number"
                value={form.subtotal}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="ITBIS"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, taxAmount: value }))
                  }
                  type="number"
                  value={form.taxAmount}
                />
                <Field
                  label="Descuento"
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      discountAmount: value,
                    }))
                  }
                  type="number"
                  value={form.discountAmount}
                />
              </div>
              <Field
                label="Notas"
                onChange={(value) =>
                  setForm((current) => ({ ...current, notes: value }))
                }
                value={form.notes}
              />
              <Button
                disabled={submitting || !form.subscriptionId}
                type="submit"
              >
                Crear factura
              </Button>
            </div>
          </form>

          <section className={platformPanelClass}>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((option) => (
                <button
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    status === option
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  key={option}
                  onClick={() => setStatus(option)}
                  type="button"
                >
                  {option === 'ALL' ? 'Todas' : option}
                </button>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              {loading ? (
                <p className="text-sm text-slate-600">Cargando facturas...</p>
              ) : filtered.length ? (
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-3">Numero</th>
                      <th className="py-3">Empresa</th>
                      <th className="py-3">Plan</th>
                      <th className="py-3">Estado</th>
                      <th className="py-3">Periodo</th>
                      <th className="py-3">Vence</th>
                      <th className="py-3">Total</th>
                      <th className="py-3">Balance</th>
                      <th className="py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((invoice) => (
                      <tr
                        className="border-t border-slate-200 transition hover:bg-slate-50"
                        key={invoice.id}
                      >
                        <td className="py-3 font-medium text-slate-950">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="py-3">
                          {invoice.company?.name ?? 'Empresa'}
                        </td>
                        <td className="py-3">{invoice.plan.name}</td>
                        <td className="py-3">
                          <PlatformInvoiceStatusBadge status={invoice.status} />
                        </td>
                        <td className="py-3">
                          {formatDate(invoice.billingPeriodStart)} -{' '}
                          {formatDate(invoice.billingPeriodEnd)}
                        </td>
                        <td className="py-3">{formatDate(invoice.dueDate)}</td>
                        <td className="py-3">{platformMoney(invoice.total)}</td>
                        <td className="py-3">
                          {platformMoney(invoice.balance)}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            className={platformLinkClass}
                            href={`/platform/billing/invoices/${invoice.id}`}
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay facturas en este filtro.
                </p>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className={platformLabelClass}>
      <span>{label}</span>
      <input
        className={platformInputClass}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function nextMonthInput() {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-DO');
}
