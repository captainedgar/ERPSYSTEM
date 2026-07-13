'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

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
import {
  cancelSubscriptionPaymentLink,
  createSubscriptionPaymentLink,
  getSubscriptionInvoice,
  listSubscriptionPaymentLinks,
  registerCompanySubscriptionPayment,
  voidSubscriptionInvoice,
  type SubscriptionInvoice,
  type SubscriptionPaymentLink,
  type SubscriptionPaymentMethod,
} from '@/lib/platform';

const paymentMethods: SubscriptionPaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CARD_MANUAL',
  'CHECK',
  'OTHER',
];

export default function PlatformInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<SubscriptionPaymentLink[]>(
    [],
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [linkExpiresAt, setLinkExpiresAt] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'BANK_TRANSFER' as SubscriptionPaymentMethod,
    reference: '',
    notes: '',
    paidAt: todayInput(),
  });
  const [voidReason, setVoidReason] = useState('');

  async function refresh() {
    const [nextInvoice, nextLinks] = await Promise.all([
      getSubscriptionInvoice(params.id),
      listSubscriptionPaymentLinks(params.id),
    ]);
    setInvoice(nextInvoice);
    setPaymentLinks(nextLinks);
    setPaymentForm((current) => ({
      ...current,
      amount: current.amount || String(Number(nextInvoice.balance)),
    }));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextInvoice, nextLinks] = await Promise.all([
          getSubscriptionInvoice(params.id),
          listSubscriptionPaymentLinks(params.id),
        ]);
        if (cancelled) return;
        setInvoice(nextInvoice);
        setPaymentLinks(nextLinks);
        setPaymentForm((current) => ({
          ...current,
          amount: String(Number(nextInvoice.balance)),
        }));
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudo cargar la factura.', reason),
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await registerCompanySubscriptionPayment(invoice.companyId, {
        amount: Number(paymentForm.amount),
        currency: 'DOP',
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
        paidAt: paymentForm.paidAt,
        subscriptionInvoiceId: invoice.id,
      });
      setMessage('Pago asociado a factura registrado correctamente.');
      setPaymentForm((current) => ({
        ...current,
        reference: '',
        notes: '',
        paidAt: todayInput(),
      }));
      await refresh();
    } catch (reason) {
      setError(platformErrorMessage('No se pudo registrar el pago.', reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function voidInvoice() {
    if (!invoice) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      setInvoice(
        await voidSubscriptionInvoice(
          invoice.id,
          voidReason || 'Anulada desde Platform Admin',
        ),
      );
      setMessage('Factura anulada correctamente.');
    } catch (reason) {
      setError(platformErrorMessage('No se pudo anular la factura.', reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function createPaymentLink() {
    if (!invoice) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const link = await createSubscriptionPaymentLink(invoice.id, {
        expiresAt: linkExpiresAt || undefined,
      });
      setPaymentLinks((current) => [link, ...current]);
      setLinkExpiresAt('');
      setMessage('Link de pago generado correctamente.');
    } catch (reason) {
      setError(platformErrorMessage('No se pudo generar el link.', reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelPaymentLink(link: SubscriptionPaymentLink) {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const cancelled = await cancelSubscriptionPaymentLink(
        link.id,
        'Cancelado desde Platform Admin',
      );
      setPaymentLinks((current) =>
        current.map((item) => (item.id === cancelled.id ? cancelled : item)),
      );
      setMessage('Link de pago cancelado.');
    } catch (reason) {
      setError(platformErrorMessage('No se pudo cancelar el link.', reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPaymentLink(token: string) {
    const url = paymentUrl(token);
    await navigator.clipboard?.writeText(url);
    setMessage('Link copiado al portapapeles.');
  }

  if (!invoice && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        Cargando factura...
      </main>
    );
  }

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title={invoice?.invoiceNumber ?? 'Factura SaaS'} />
          {invoice && (
            <div className="flex flex-wrap gap-3">
              <Link
                className={platformLinkClass}
                href={`/platform/billing/invoices/${invoice.id}/print`}
              >
                Imprimir
              </Link>
              <Link
                className={platformLinkClass}
                href="/platform/billing/invoices"
              >
                Volver
              </Link>
            </div>
          )}
        </div>
        {error && <p className={platformErrorClass}>{error}</p>}
        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}
        {invoice && (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-4">
              <InfoCard label="Estado">
                <PlatformInvoiceStatusBadge status={invoice.status} />
              </InfoCard>
              <InfoCard label="Total">{platformMoney(invoice.total)}</InfoCard>
              <InfoCard label="Pagado">
                {platformMoney(invoice.amountPaid)}
              </InfoCard>
              <InfoCard label="Balance">
                {platformMoney(invoice.balance)}
              </InfoCard>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
              <div className={platformPanelClass}>
                <h2 className="text-lg font-semibold text-slate-950">
                  Detalle
                </h2>
                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <Info
                    label="Empresa"
                    value={invoice.company?.name ?? 'N/D'}
                  />
                  <Info label="Plan" value={invoice.plan.name} />
                  <Info
                    label="Periodo"
                    value={`${formatDate(invoice.billingPeriodStart)} - ${formatDate(
                      invoice.billingPeriodEnd,
                    )}`}
                  />
                  <Info label="Emision" value={formatDate(invoice.issueDate)} />
                  <Info
                    label="Vencimiento"
                    value={formatDate(invoice.dueDate)}
                  />
                  <Info
                    label="Subtotal"
                    value={platformMoney(invoice.subtotal)}
                  />
                  <Info
                    label="ITBIS"
                    value={platformMoney(invoice.taxAmount)}
                  />
                  <Info
                    label="Descuento"
                    value={platformMoney(invoice.discountAmount)}
                  />
                </dl>
                <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-700">
                  Documento interno de cobro SaaS. No valido como comprobante
                  fiscal.
                </p>
                {invoice.notes && (
                  <p className="mt-4 text-sm text-slate-600">{invoice.notes}</p>
                )}
              </div>

              <div className="grid gap-6">
                <div className={platformPanelClass}>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Links de pago
                  </h2>
                  <div className="mt-4 grid gap-3">
                    <Field
                      label="Expira en (opcional)"
                      onChange={setLinkExpiresAt}
                      type="date"
                      value={linkExpiresAt}
                    />
                    <Button
                      disabled={
                        submitting ||
                        invoice.status === 'PAID' ||
                        invoice.status === 'VOIDED' ||
                        invoice.status === 'CANCELLED'
                      }
                      onClick={() => void createPaymentLink()}
                      type="button"
                    >
                      Generar link
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {paymentLinks.length ? (
                      paymentLinks.map((link) => (
                        <div
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                          key={link.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-950">
                                {link.status} / {platformMoney(link.amount)}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {paymentUrl(link.token)}
                              </p>
                              {link.expiresAt && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Expira: {formatDate(link.expiresAt)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              onClick={() => void copyPaymentLink(link.token)}
                              type="button"
                              variant="secondary"
                            >
                              Copiar
                            </Button>
                            <Button
                              disabled={submitting || link.status !== 'ACTIVE'}
                              onClick={() => void cancelPaymentLink(link)}
                              type="button"
                              variant="secondary"
                            >
                              Cancelar
                            </Button>
                          </div>
                          {link.reports?.length ? (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                              {link.reports.length} pago(s) reportado(s).
                              Ultimo: {platformMoney(link.reports[0]?.amount)} /{' '}
                              {link.reports[0]?.reference ?? 'sin referencia'}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        Sin links generados.
                      </p>
                    )}
                  </div>
                </div>

                <form
                  className={platformPanelClass}
                  onSubmit={(event) => void submitPayment(event)}
                >
                  <h2 className="text-lg font-semibold text-slate-950">
                    Registrar pago
                  </h2>
                  <div className="mt-4 grid gap-3">
                    <Field
                      label="Monto"
                      onChange={(value) =>
                        setPaymentForm((current) => ({
                          ...current,
                          amount: value,
                        }))
                      }
                      type="number"
                      value={paymentForm.amount}
                    />
                    <label className={platformLabelClass}>
                      <span>Metodo</span>
                      <select
                        className={platformInputClass}
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            method: event.target
                              .value as SubscriptionPaymentMethod,
                          }))
                        }
                        value={paymentForm.method}
                      >
                        {paymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="Pagado en"
                      onChange={(value) =>
                        setPaymentForm((current) => ({
                          ...current,
                          paidAt: value,
                        }))
                      }
                      type="date"
                      value={paymentForm.paidAt}
                    />
                    <Field
                      label="Referencia"
                      onChange={(value) =>
                        setPaymentForm((current) => ({
                          ...current,
                          reference: value,
                        }))
                      }
                      value={paymentForm.reference}
                    />
                    <Field
                      label="Notas"
                      onChange={(value) =>
                        setPaymentForm((current) => ({
                          ...current,
                          notes: value,
                        }))
                      }
                      value={paymentForm.notes}
                    />
                    <Button
                      disabled={
                        submitting ||
                        invoice.status === 'PAID' ||
                        invoice.status === 'VOIDED'
                      }
                      type="submit"
                    >
                      Registrar pago
                    </Button>
                  </div>
                </form>

                <div className={platformPanelClass}>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Anular factura
                  </h2>
                  <div className="mt-4 grid gap-3">
                    <Field
                      label="Motivo"
                      onChange={setVoidReason}
                      value={voidReason}
                    />
                    <Button
                      disabled={
                        submitting ||
                        invoice.status === 'PAID' ||
                        invoice.status === 'VOIDED'
                      }
                      onClick={() => void voidInvoice()}
                      type="button"
                      variant="secondary"
                    >
                      Anular
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className={`mt-6 ${platformPanelClass}`}>
              <h2 className="text-lg font-semibold text-slate-950">
                Pagos asociados
              </h2>
              <div className="mt-4 grid gap-3">
                {invoice.payments?.length ? (
                  invoice.payments.map((payment) => (
                    <div
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      key={payment.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-950">
                            {payment.method}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(payment.paidAt)}
                          </p>
                        </div>
                        <p className="font-semibold text-slate-950">
                          {platformMoney(payment.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    Sin pagos asociados.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function InfoCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={platformPanelClass}>
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <div className="mt-2 text-sm font-semibold text-slate-950">
        {children}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-slate-950">{value}</dd>
    </div>
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

function paymentUrl(token: string) {
  const origin =
    typeof window === 'undefined'
      ? 'http://localhost:3000'
      : window.location.origin;
  return `${origin}/pay/invoice/${token}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-DO');
}
