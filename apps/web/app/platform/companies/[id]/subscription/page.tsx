'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import {
  PlatformHeader,
  PlatformSubscriptionStatusBadge,
  platformErrorClass,
  platformErrorMessage,
  platformInputClass,
  platformLabelClass,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  getCompanySubscription,
  getPlatformCompany,
  listSaasPlans,
  listSubscriptionEvents,
  listSubscriptionPayments,
  registerSubscriptionPayment,
  upsertCompanySubscription,
  type CompanySubscription,
  type CompanySubscriptionStatus,
  type PlatformCompany,
  type SaasPlan,
  type SubscriptionEvent,
  type SubscriptionPayment,
  type SubscriptionPaymentMethod,
} from '@/lib/platform';

const statusOptions: CompanySubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'PAYMENT_DUE',
  'GRACE_PERIOD',
  'SUSPENDED',
  'CANCELLED',
];

const paymentMethods: SubscriptionPaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CARD_MANUAL',
  'CHECK',
  'OTHER',
];

export default function PlatformCompanySubscriptionPage() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<PlatformCompany | null>(null);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [subscription, setSubscription] = useState<CompanySubscription | null>(
    null,
  );
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    planId: '',
    status: 'ACTIVE' as CompanySubscriptionStatus,
    startsAt: '',
    currentPeriodStart: '',
    currentPeriodEnd: '',
    nextPaymentDueAt: '',
    graceDays: '5',
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'BANK_TRANSFER' as SubscriptionPaymentMethod,
    reference: '',
    notes: '',
    paidAt: todayInput(),
    nextPaymentDueAt: '',
  });

  async function refresh() {
    setError('');
    try {
      const [
        nextCompany,
        nextPlans,
        nextSubscription,
        nextPayments,
        nextEvents,
      ] = await Promise.all([
        getPlatformCompany(params.id),
        listSaasPlans(),
        getCompanySubscription(params.id),
        listSubscriptionPayments(params.id),
        listSubscriptionEvents(params.id),
      ]);
      setCompany(nextCompany);
      setPlans(nextPlans);
      setSubscription(nextSubscription);
      setPayments(nextPayments);
      setEvents(nextEvents);
      setSubscriptionForm({
        planId: nextSubscription?.planId ?? nextPlans[0]?.id ?? '',
        status: nextSubscription?.status ?? 'ACTIVE',
        startsAt: toInputDate(nextSubscription?.startsAt),
        currentPeriodStart: toInputDate(nextSubscription?.currentPeriodStart),
        currentPeriodEnd: toInputDate(nextSubscription?.currentPeriodEnd),
        nextPaymentDueAt: toInputDate(nextSubscription?.nextPaymentDueAt),
        graceDays: String(nextSubscription?.graceDays ?? 5),
      });
      setPaymentForm((current) => ({
        ...current,
        amount: nextSubscription
          ? String(Number(nextSubscription.plan.price))
          : current.amount,
      }));
    } catch (reason) {
      setError(
        platformErrorMessage('No se pudo cargar la informacion.', reason),
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      try {
        const [
          nextCompany,
          nextPlans,
          nextSubscription,
          nextPayments,
          nextEvents,
        ] = await Promise.all([
          getPlatformCompany(params.id),
          listSaasPlans(),
          getCompanySubscription(params.id),
          listSubscriptionPayments(params.id),
          listSubscriptionEvents(params.id),
        ]);
        if (cancelled) return;
        setCompany(nextCompany);
        setPlans(nextPlans);
        setSubscription(nextSubscription);
        setPayments(nextPayments);
        setEvents(nextEvents);
        setSubscriptionForm({
          planId: nextSubscription?.planId ?? nextPlans[0]?.id ?? '',
          status: nextSubscription?.status ?? 'ACTIVE',
          startsAt: toInputDate(nextSubscription?.startsAt),
          currentPeriodStart: toInputDate(nextSubscription?.currentPeriodStart),
          currentPeriodEnd: toInputDate(nextSubscription?.currentPeriodEnd),
          nextPaymentDueAt: toInputDate(nextSubscription?.nextPaymentDueAt),
          graceDays: String(nextSubscription?.graceDays ?? 5),
        });
        setPaymentForm((current) => ({
          ...current,
          amount: nextSubscription
            ? String(Number(nextSubscription.plan.price))
            : current.amount,
        }));
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudo cargar la informacion.', reason),
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function submitSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await upsertCompanySubscription(params.id, {
        planId: subscriptionForm.planId,
        status: subscriptionForm.status,
        startsAt: subscriptionForm.startsAt || undefined,
        currentPeriodStart: subscriptionForm.currentPeriodStart || undefined,
        currentPeriodEnd: subscriptionForm.currentPeriodEnd || undefined,
        nextPaymentDueAt: subscriptionForm.nextPaymentDueAt || undefined,
        graceDays: Number(subscriptionForm.graceDays),
      });
      await refresh();
      setMessage('Suscripcion guardada correctamente.');
    } catch (reason) {
      setError(
        platformErrorMessage('No se pudo guardar la suscripcion.', reason),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await registerSubscriptionPayment(params.id, {
        amount: Number(paymentForm.amount),
        currency: 'DOP',
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
        paidAt: paymentForm.paidAt,
        nextPaymentDueAt: paymentForm.nextPaymentDueAt || undefined,
      });
      setPaymentForm((current) => ({
        ...current,
        reference: '',
        notes: '',
        paidAt: todayInput(),
      }));
      await refresh();
      setMessage('Pago registrado correctamente.');
    } catch (reason) {
      setError(platformErrorMessage('No se pudo registrar el pago.', reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title={company?.name ?? 'Suscripcion'} />
          <Link className={platformLinkClass} href="/platform/billing">
            Volver a billing
          </Link>
        </div>
        {error && <p className={platformErrorClass}>{error}</p>}
        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}
        {subscription?.status === 'GRACE_PERIOD' && (
          <Alert tone="amber">Esta empresa esta en periodo de gracia.</Alert>
        )}
        {subscription?.status === 'SUSPENDED' && (
          <Alert tone="red">
            Esta empresa esta suspendida por falta de pago.
          </Alert>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <InfoCard label="Estado actual">
            {subscription ? (
              <PlatformSubscriptionStatusBadge status={subscription.status} />
            ) : (
              'N/D'
            )}
          </InfoCard>
          <InfoCard label="Proximo pago">
            {formatDate(subscription?.nextPaymentDueAt)}
          </InfoCard>
          <InfoCard label="Fecha de gracia">
            {formatDate(subscription?.graceEndsAt)}
          </InfoCard>
          <InfoCard label="Suspension programada">
            {formatDate(subscription?.scheduledSuspensionAt)}
          </InfoCard>
          <InfoCard label="Fecha de suspension">
            {formatDate(subscription?.suspendedAt)}
          </InfoCard>
          <InfoCard label="Periodo actual">
            {subscription
              ? `${formatDate(subscription.currentPeriodStart)} - ${formatDate(
                  subscription.currentPeriodEnd,
                )}`
              : 'N/D'}
          </InfoCard>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="grid gap-6">
            <form
              className={platformPanelClass}
              onSubmit={(event) => void submitSubscription(event)}
            >
              <h2 className="text-lg font-semibold text-slate-950">
                Asignar suscripcion
              </h2>
              <div className="mt-4 grid gap-3">
                <label className={platformLabelClass}>
                  <span>Plan</span>
                  <select
                    className={platformInputClass}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        planId: event.target.value,
                      }))
                    }
                    required
                    value={subscriptionForm.planId}
                  >
                    {plans
                      .filter((plan) => plan.isActive)
                      .map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} / {platformMoney(plan.price)}
                        </option>
                      ))}
                  </select>
                </label>
                {!plans.filter((plan) => plan.isActive).length && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                    No hay planes disponibles. Ejecuta npm run
                    db:seed-saas-plans.
                  </p>
                )}
                <label className={platformLabelClass}>
                  <span>Estado</span>
                  <select
                    className={platformInputClass}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        status: event.target.value as CompanySubscriptionStatus,
                      }))
                    }
                    value={subscriptionForm.status}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Fecha de inicio"
                  onChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      startsAt: value,
                    }))
                  }
                  type="date"
                  value={subscriptionForm.startsAt}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Inicio periodo"
                    onChange={(value) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        currentPeriodStart: value,
                      }))
                    }
                    type="date"
                    value={subscriptionForm.currentPeriodStart}
                  />
                  <Field
                    label="Fin periodo"
                    onChange={(value) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        currentPeriodEnd: value,
                      }))
                    }
                    type="date"
                    value={subscriptionForm.currentPeriodEnd}
                  />
                </div>
                <Field
                  label="Proximo pago"
                  onChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      nextPaymentDueAt: value,
                    }))
                  }
                  type="date"
                  value={subscriptionForm.nextPaymentDueAt}
                />
                <Field
                  label="Dias de gracia"
                  onChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      graceDays: value,
                    }))
                  }
                  type="number"
                  value={subscriptionForm.graceDays}
                />
                <Button
                  disabled={submitting || !subscriptionForm.planId}
                  type="submit"
                >
                  Guardar suscripcion
                </Button>
              </div>
            </form>
            <form
              className={platformPanelClass}
              onSubmit={(event) => void submitPayment(event)}
            >
              <h2 className="text-lg font-semibold text-slate-950">
                Registrar pago manual
              </h2>
              <div className="mt-4 grid gap-3">
                <Field
                  label="Monto"
                  onChange={(value) =>
                    setPaymentForm((current) => ({ ...current, amount: value }))
                  }
                  required
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
                        method: event.target.value as SubscriptionPaymentMethod,
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
                    setPaymentForm((current) => ({ ...current, paidAt: value }))
                  }
                  required
                  type="date"
                  value={paymentForm.paidAt}
                />
                <Field
                  label="Nuevo proximo pago"
                  onChange={(value) =>
                    setPaymentForm((current) => ({
                      ...current,
                      nextPaymentDueAt: value,
                    }))
                  }
                  type="date"
                  value={paymentForm.nextPaymentDueAt}
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
                    setPaymentForm((current) => ({ ...current, notes: value }))
                  }
                  value={paymentForm.notes}
                />
                <Button disabled={submitting || !subscription} type="submit">
                  Registrar pago
                </Button>
              </div>
            </form>
          </div>
          <div className="grid gap-6">
            <HistoryPanel title="Pagos">
              {payments.length ? (
                payments.map((payment) => (
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
                    {payment.reference && (
                      <p className="mt-2 text-sm text-slate-500">
                        Ref: {payment.reference}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <Empty text="Sin pagos registrados." />
              )}
            </HistoryPanel>
            <HistoryPanel title="Eventos">
              {events.length ? (
                events.map((event) => (
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    key={event.id}
                  >
                    <p className="font-medium text-slate-950">{event.type}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.message}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <Empty text="Sin eventos de suscripcion." />
              )}
            </HistoryPanel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Alert({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'amber' | 'red';
}) {
  const classes =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <p className={`mt-4 rounded-lg border p-4 text-sm font-medium ${classes}`}>
      {children}
    </p>
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

function Field({
  label,
  onChange,
  required,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className={platformLabelClass}>
      <span>{label}</span>
      <input
        className={platformInputClass}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function HistoryPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className={platformPanelClass}>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      {text}
    </p>
  );
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function toInputDate(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/D';
  return new Date(value).toLocaleDateString('es-DO');
}
