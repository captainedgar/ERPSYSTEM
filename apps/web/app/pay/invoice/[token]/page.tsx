'use client';

import { Button } from '@comercia/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import {
  getPublicSubscriptionPaymentLink,
  platformMoney,
  reportPublicSubscriptionPayment,
  type PublicSubscriptionPaymentLink,
} from '@/lib/platform';

export default function PublicInvoicePaymentPage() {
  const params = useParams<{ token: string }>();
  const [link, setLink] = useState<PublicSubscriptionPaymentLink | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    payerName: '',
    payerEmail: '',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextLink = await getPublicSubscriptionPaymentLink(params.token);
        if (cancelled) return;
        setLink(nextLink);
        setForm((current) => ({
          ...current,
          amount: String(Number(nextLink.invoice.balance)),
        }));
      } catch {
        if (!cancelled) setError('No pudimos cargar este link de pago.');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await reportPublicSubscriptionPayment(params.token, {
        amount: Number(form.amount),
        payerName: form.payerName || undefined,
        payerEmail: form.payerEmail || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      setLink(response.link);
      setMessage(
        'Pago reportado. Nuestro equipo validara la informacion y confirmara el pago manualmente.',
      );
      setForm((current) => ({ ...current, reference: '', notes: '' }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo reportar el pago.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!link && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        Cargando factura...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold text-blue-700">Comercia ERP</p>
          <h1 className="mt-1 text-3xl font-semibold">Factura SaaS</h1>
          <p className="mt-2 text-sm text-slate-600">
            Link seguro para consulta y notificacion de pago.
          </p>
        </header>

        {error && (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}

        {link && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {link.invoice.invoiceNumber}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {link.invoice.company.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Plan {link.invoice.plan.name}
                  </p>
                </div>
                <StatusBadge status={link.status} />
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <Info label="Estado factura" value={link.invoice.status} />
                <Info
                  label="Vencimiento"
                  value={formatDate(link.invoice.dueDate)}
                />
                <Info
                  label="Periodo"
                  value={`${formatDate(link.invoice.billingPeriodStart)} - ${formatDate(
                    link.invoice.billingPeriodEnd,
                  )}`}
                />
                <Info
                  label="Monto pendiente"
                  value={platformMoney(link.invoice.balance)}
                />
              </dl>

              <div className="mt-6 rounded-lg border border-slate-200">
                <Row
                  label="Subtotal"
                  value={platformMoney(link.invoice.subtotal)}
                />
                <Row
                  label="ITBIS"
                  value={platformMoney(link.invoice.taxAmount)}
                />
                <Row
                  label="Descuento"
                  value={platformMoney(link.invoice.discountAmount)}
                />
                <Row
                  label="Total"
                  strong
                  value={platformMoney(link.invoice.total)}
                />
                <Row
                  label="Pagado"
                  value={platformMoney(link.invoice.amountPaid)}
                />
                <Row
                  label="Balance"
                  strong
                  value={platformMoney(link.invoice.balance)}
                />
              </div>

              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Realiza el pago por transferencia bancaria o el metodo acordado
                con Comercia ERP. Luego reporta la referencia para que el equipo
                de plataforma lo confirme manualmente.
              </div>

              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                Documento interno de cobro SaaS. No valido como comprobante
                fiscal.
              </p>
            </section>

            <form
              className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={(event) => void submitReport(event)}
            >
              <h2 className="text-lg font-semibold">Notificar pago</h2>
              <div className="mt-4 grid gap-3">
                <Field
                  label="Monto"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, amount: value }))
                  }
                  type="number"
                  value={form.amount}
                />
                <Field
                  label="Nombre"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, payerName: value }))
                  }
                  value={form.payerName}
                />
                <Field
                  label="Correo"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, payerEmail: value }))
                  }
                  type="email"
                  value={form.payerEmail}
                />
                <Field
                  label="Referencia"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, reference: value }))
                  }
                  value={form.reference}
                />
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  <span>Notas</span>
                  <textarea
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    rows={3}
                    value={form.notes}
                  />
                </label>
                <Button
                  disabled={
                    submitting ||
                    link.status !== 'ACTIVE' ||
                    Number(form.amount) <= 0
                  }
                  type="submit"
                >
                  Reportar pago
                </Button>
              </div>
              {link.reports.length ? (
                <p className="mt-4 text-xs text-slate-500">
                  Ya hay {link.reports.length} reporte(s) recibido(s) para este
                  link.
                </p>
              ) : null}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

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
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-950">{value}</dd>
    </div>
  );
}

function Row({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={`flex justify-between border-b border-slate-200 px-4 py-3 last:border-b-0 ${
        strong ? 'text-lg font-semibold' : 'text-sm'
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-DO');
}
