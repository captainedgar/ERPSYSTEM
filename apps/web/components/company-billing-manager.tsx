'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  cancelCompanyPlanChangeRequest,
  capturePayPalCheckout,
  createPlanChangeCheckout,
  getMyBillingEvents,
  getCompanyPaymentInstructions,
  getPaymentProviderStatus,
  getMyEntitlements,
  getMyInvoicePaymentLink,
  getMyInvoices,
  getMyPayments,
  getMySubscription,
  getAvailableCompanyPlans,
  getMyPlanChangeRequests,
  requestCompanyPlanChange,
  type CompanyBillingEvent,
  type CompanyBillingInvoice,
  type CompanyBillingPayment,
  type CompanyBillingSubscription,
  type CompanyEntitlements,
  type CompanyPlanOption,
  type CompanyPlanChangeRequest,
  type PaymentInstructions,
  type PaymentProviderStatus,
} from '@/lib/company-billing';
import { hasPermission } from '@/lib/permissions';

export function CompanyBillingManager({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [subscription, setSubscription] =
    useState<CompanyBillingSubscription | null>(null);
  const [invoices, setInvoices] = useState<CompanyBillingInvoice[]>([]);
  const [payments, setPayments] = useState<CompanyBillingPayment[]>([]);
  const [events, setEvents] = useState<CompanyBillingEvent[]>([]);
  const [entitlements, setEntitlements] = useState<CompanyEntitlements | null>(
    null,
  );
  const [plans, setPlans] = useState<CompanyPlanOption[]>([]);
  const [planRequests, setPlanRequests] = useState<CompanyPlanChangeRequest[]>(
    [],
  );
  const [paymentInstructions, setPaymentInstructions] =
    useState<PaymentInstructions | null>(null);
  const [paymentProvider, setPaymentProvider] =
    useState<PaymentProviderStatus | null>(null);
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [message, setMessage] = useState(initialPayPalReturnMessage);
  const [error, setError] = useState(initialPayPalReturnError);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getMySubscription(),
      getMyInvoices(),
      getMyPayments(),
      getMyBillingEvents(),
      getMyEntitlements(),
      getAvailableCompanyPlans(),
      getMyPlanChangeRequests(),
      getCompanyPaymentInstructions(),
      getPaymentProviderStatus(),
    ])
      .then(
        ([
          nextSubscription,
          nextInvoices,
          nextPayments,
          nextEvents,
          nextEntitlements,
          nextPlans,
          nextPlanRequests,
          nextPaymentInstructions,
          nextPaymentProvider,
        ]) => {
          if (cancelled) return;
          setSubscription(nextSubscription);
          setInvoices(nextInvoices);
          setPayments(nextPayments);
          setEvents(nextEvents);
          setEntitlements(nextEntitlements);
          setPlans(nextPlans);
          setPlanRequests(nextPlanRequests);
          setPaymentInstructions(nextPaymentInstructions);
          setPaymentProvider(nextPaymentProvider);
          setLoadedAt(Date.now());
        },
      )
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la facturacion SaaS.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('paypal') !== 'return') return;
    const checkoutSessionId = query.get('checkoutSessionId');
    if (!checkoutSessionId) return;
    let cancelled = false;
    void capturePayPalCheckout(checkoutSessionId)
      .then(async (result) => {
        if (cancelled) return;
        setMessage(result.message);
        const [
          nextSubscription,
          nextInvoices,
          nextPayments,
          nextEvents,
          nextEntitlements,
          nextRequests,
        ] = await Promise.all([
          getMySubscription(),
          getMyInvoices(),
          getMyPayments(),
          getMyBillingEvents(),
          getMyEntitlements(),
          getMyPlanChangeRequests(),
        ]);
        if (cancelled) return;
        setSubscription(nextSubscription);
        setInvoices(nextInvoices);
        setPayments(nextPayments);
        setEvents(nextEvents);
        setEntitlements(nextEntitlements);
        setPlanRequests(nextRequests);
        window.history.replaceState({}, '', '/settings/billing');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setMessage('');
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo confirmar el pago con PayPal. La solicitud sigue pendiente.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingBalance = useMemo(
    () =>
      invoices
        .filter((invoice) =>
          ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status),
        )
        .reduce((total, invoice) => total + Number(invoice.balance), 0),
    [invoices],
  );

  async function openPayment(invoice: CompanyBillingInvoice) {
    setError('');
    try {
      const link =
        invoice.paymentLinks[0] ?? (await getMyInvoicePaymentLink(invoice.id));
      window.open(
        `/pay/invoice/${link.token}`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Solicita un link al equipo de facturacion.',
      );
    }
  }

  async function requestChange(plan: CompanyPlanOption) {
    setError('');
    setMessage('');
    setRequestingPlan(plan.code);
    try {
      const response = await requestCompanyPlanChange(plan.code);
      setMessage(
        response.message ??
          'Solicitud registrada. Nuestro equipo revisara el cambio.',
      );
      setPlanRequests(await getMyPlanChangeRequests());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo solicitar el cambio.',
      );
    } finally {
      setRequestingPlan(null);
    }
  }

  async function cancelPendingRequest() {
    if (!pendingPlanRequest) return;
    setCancellingRequest(true);
    setError('');
    setMessage('');
    try {
      const response = await cancelCompanyPlanChangeRequest(
        pendingPlanRequest.id,
      );
      setMessage(response.message);
      setPlanRequests(await getMyPlanChangeRequests());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cancelar la solicitud.',
      );
    } finally {
      setCancellingRequest(false);
    }
  }

  async function payPlanChange() {
    if (!latestPlanRequest) return;
    setStartingCheckout(true);
    setError('');
    try {
      const checkout = await createPlanChangeCheckout(latestPlanRequest.id);
      if (!checkout.checkoutUrl)
        throw new Error(
          'No se pudo iniciar el checkout. Intenta nuevamente o contacta soporte.',
        );
      window.location.assign(checkout.checkoutUrl);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo iniciar el pago.',
      );
      setStartingCheckout(false);
    }
  }

  const latestPlanRequest = planRequests[0] ?? null;
  const pendingPlanRequest = planRequests.find(
    (request) =>
      request.status === 'PENDING' ||
      request.status === 'APPROVED_PENDING_PAYMENT' ||
      request.status === 'PAYMENT_FAILED',
  );

  if (loading) {
    return (
      <p className="p-6 text-sm text-slate-600">Cargando suscripcion...</p>
    );
  }

  return (
    <main className={compact ? '' : 'px-5 py-8'}>
      <div className={compact ? '' : 'mx-auto max-w-7xl'}>
        {!compact && (
          <>
            <p className="text-sm font-semibold text-blue-700">Configuracion</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">
              Suscripcion y pagos
            </h1>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Plan" value={subscription?.plan.name ?? 'Sin plan'} />
          <Metric
            label="Estado"
            value={subscription?.status ?? 'NO ASIGNADO'}
          />
          <Metric
            label="Proximo vencimiento"
            value={formatDate(subscription?.nextPaymentDueAt)}
          />
          <Metric label="Balance pendiente" value={money(pendingBalance)} />
        </section>

        {subscription && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Resumen de suscripcion
            </h2>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-3">
              <Info label="Inicio" value={formatDate(subscription.startsAt)} />
              <Info
                label="Fin del periodo"
                value={formatDate(subscription.currentPeriodEnd)}
              />
              <Info
                label="Dias restantes"
                value={daysRemaining(subscription.nextPaymentDueAt, loadedAt)}
              />
              <Info
                label="Precio"
                value={`${money(subscription.plan.price)} / ${
                  subscription.plan.billingInterval === 'YEARLY' ? 'ano' : 'mes'
                }`}
              />
              <Info
                label="Empresa"
                value={`${subscription.company.name} · ${subscription.company.status}`}
              />
              <Info
                label="Fin de gracia"
                value={formatDate(subscription.graceEndsAt)}
              />
            </dl>
          </section>
        )}

        {entitlements && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Uso de tu plan
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Usage
                label="Sucursales"
                limit={entitlements.limits.maxBranches}
                value={entitlements.usage.branches}
              />
              <Usage
                label="Usuarios"
                limit={entitlements.limits.maxUsers}
                value={entitlements.usage.users}
              />
              <Usage
                label="Productos"
                limit={entitlements.limits.maxProducts}
                value={entitlements.usage.products}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {entitlements.features.map((feature) => (
                <span
                  className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  key={feature}
                >
                  {feature}
                </span>
              ))}
            </div>
            {subscription?.status === 'GRACE_PERIOD' && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Tu suscripcion esta en periodo de gracia. Regulariza el pago
                antes del {formatDate(subscription.graceEndsAt)}.
              </p>
            )}
          </section>
        )}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Facturas SaaS
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="py-3">Numero</th>
                  <th className="py-3">Emision</th>
                  <th className="py-3">Vencimiento</th>
                  <th className="py-3">Estado</th>
                  <th className="py-3">Total</th>
                  <th className="py-3">Balance</th>
                  <th className="py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr className="border-t border-slate-200" key={invoice.id}>
                    <td className="py-3 font-medium text-slate-950">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="py-3">{formatDate(invoice.issueDate)}</td>
                    <td className="py-3">{formatDate(invoice.dueDate)}</td>
                    <td className="py-3">{invoice.status}</td>
                    <td className="py-3">{money(invoice.total)}</td>
                    <td className="py-3">{money(invoice.balance)}</td>
                    <td className="py-3 text-right">
                      {['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(
                        invoice.status,
                      ) &&
                        hasPermission(user, 'billing.pay') && (
                          <Button
                            onClick={() => void openPayment(invoice)}
                            type="button"
                          >
                            {invoice.paymentLinks.length
                              ? 'Pagar / reportar'
                              : 'Solicitar link'}
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!invoices.length && (
              <p className="py-4 text-sm text-slate-500">
                No hay facturas SaaS registradas.
              </p>
            )}
          </div>
        </section>

        {!compact && (
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Pagos registrados">
              {payments.map((payment) => (
                <Item
                  detail={`${payment.method} · ${
                    payment.reference ?? 'Sin referencia'
                  }`}
                  key={payment.id}
                  title={`${formatDate(payment.paidAt)} · ${money(payment.amount)}`}
                />
              ))}
              {!payments.length && <Empty text="No hay pagos confirmados." />}
            </Panel>
            <Panel title="Eventos de suscripcion">
              {events.slice(0, 10).map((event) => (
                <Item
                  detail={formatDateTime(event.createdAt)}
                  key={event.id}
                  title={event.message}
                />
              ))}
              {!events.length && <Empty text="No hay eventos registrados." />}
            </Panel>
          </div>
        )}

        {!compact && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Cambiar plan
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              La solicitud no cambia precios, plan ni pagos automaticamente.
              Platform Admin debe revisarla.
            </p>
            {latestPlanRequest && (
              <div
                className={`mt-4 rounded-lg border p-4 text-sm ${
                  latestPlanRequest.status === 'PENDING'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : latestPlanRequest.status === 'APPROVED_APPLIED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <p className="font-semibold">
                  {latestPlanRequest.status === 'PENDING'
                    ? `Ya tienes una solicitud pendiente para cambiar a ${latestPlanRequest.requestedPlanName ?? latestPlanRequest.requestedPlanCode}. Debe ser revisada por Platform Admin.`
                    : latestPlanRequest.status === 'APPROVED_APPLIED'
                      ? `Tu solicitud fue aprobada. Tu plan actual ahora es ${latestPlanRequest.requestedPlanName ?? latestPlanRequest.requestedPlanCode}.`
                      : latestPlanRequest.status === 'APPROVED_PENDING_PAYMENT'
                        ? 'Cambio aprobado. Completa el pago para aplicar el plan.'
                        : latestPlanRequest.status === 'CANCELLED'
                          ? 'Tu solicitud fue cancelada.'
                          : 'Tu solicitud fue rechazada. Contacta a facturacion para mas detalles.'}
                </p>
                <p className="mt-1 text-xs">
                  Solicitada el {formatDateTime(latestPlanRequest.createdAt)}
                </p>
                {latestPlanRequest.adminNote && (
                  <p className="mt-2">{latestPlanRequest.adminNote}</p>
                )}
                {latestPlanRequest.status === 'PENDING' && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      disabled={cancellingRequest}
                      onClick={() => void cancelPendingRequest()}
                      type="button"
                      variant="secondary"
                    >
                      {cancellingRequest
                        ? 'Cancelando...'
                        : 'Cancelar solicitud'}
                    </Button>
                    <a
                      className="inline-flex items-center text-sm font-semibold text-blue-700"
                      href={`mailto:${paymentInstructions?.billingContact.email ?? 'facturacion@comerciaerp.local'}`}
                    >
                      Contactar facturacion
                    </a>
                  </div>
                )}
                {latestPlanRequest.status === 'APPROVED_PENDING_PAYMENT' &&
                  latestPlanRequest.invoice && (
                    <div className="mt-3">
                      <Button
                        disabled={
                          startingCheckout ||
                          !paymentProvider?.onlinePaymentsEnabled
                        }
                        onClick={() => void payPlanChange()}
                        type="button"
                      >
                        {startingCheckout
                          ? 'Abriendo PayPal...'
                          : 'Pagar ahora con PayPal'}
                      </Button>
                      {!paymentProvider?.onlinePaymentsEnabled && (
                        <p className="mt-2 font-medium">
                          {paymentProvider?.message ??
                            'Pago online no configurado todavía.'}
                        </p>
                      )}
                      <p className="mt-2 text-xs">
                        Pago seguro alojado por PayPal. Comercia ERP no almacena
                        tarjeta ni CVV.
                      </p>
                    </div>
                  )}
              </div>
            )}
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {plans.map((plan) => (
                <div
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  key={plan.code}
                >
                  <p className="font-semibold text-slate-950">{plan.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {plan.customLimits
                      ? 'Precio personalizado'
                      : money(plan.price)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {limitText(plan.maxBranches, 'sucursales')} ·{' '}
                    {limitText(plan.maxUsers, 'usuarios')} ·{' '}
                    {limitText(plan.maxProducts, 'productos')}
                  </p>
                  <Button
                    className="mt-4"
                    disabled={
                      entitlements?.plan.code === plan.code ||
                      Boolean(pendingPlanRequest) ||
                      requestingPlan !== null
                    }
                    onClick={() => void requestChange(plan)}
                    type="button"
                    variant="secondary"
                  >
                    {entitlements?.plan.code === plan.code
                      ? 'Plan actual'
                      : pendingPlanRequest?.requestedPlanCode === plan.code
                        ? 'Solicitud pendiente'
                        : pendingPlanRequest
                          ? 'Espera revision'
                          : requestingPlan === plan.code
                            ? 'Enviando...'
                            : 'Solicitar cambio'}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
            <h2 className="font-semibold">Metodos de pago disponibles</h2>
            <div className="mt-3 grid gap-3">
              {paymentInstructions?.methods.map((method) => (
                <div key={method.code}>
                  <p className="font-semibold">{method.name}</p>
                  {method.bank && (
                    <p>
                      {method.bank} · {method.accountNumber}
                    </p>
                  )}
                  <p className="leading-6">{method.instructions}</p>
                </div>
              ))}
            </div>
            {paymentInstructions && (
              <p className="mt-3">
                Contacto: {paymentInstructions.billingContact.email}
              </p>
            )}
            <p className="mt-2 leading-6">
              Usa transferencia o deposito según las instrucciones compartidas
              por Comercia ERP y reporta la referencia mediante el link seguro.
              Los pagos se validan manualmente y la reactivacion puede tardar
              hasta completar la revision.
            </p>
            <p className="mt-3 font-semibold">
              Documento interno. No valido como comprobante fiscal.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            <h2 className="font-semibold text-slate-950">Metodos de pago</h2>
            <p className="mt-2">{paymentInstructions?.card.notice}</p>
            <p className="mt-2">
              El pago con tarjeta todavia no esta activo porque no hay una
              pasarela configurada. En produccion se integrara con un proveedor
              tokenizado como Azul, CardNet, Stripe o PayPal.
            </p>
            <span className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              Tarjeta de credito/debito · Proximamente
            </span>
            <p className="mt-3 text-xs text-slate-500">
              No almacenamos numero de tarjeta, CVV ni datos bancarios
              sensibles. Contacta soporte de facturacion si necesitas un link.
            </p>
          </div>
        </section>

        {compact && (
          <Link
            className="mt-5 inline-flex text-sm font-semibold text-blue-700"
            href="/settings/billing"
          >
            Abrir detalle de suscripcion y pagos
          </Link>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
function Usage({
  label,
  limit,
  value,
}: {
  label: string;
  limit: number | null;
  value: number;
}) {
  const reached = limit !== null && value >= limit;
  return (
    <div
      className={`rounded-lg border p-4 ${
        reached
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">
        {value} / {limit ?? 'Personalizado'}
      </p>
      {reached && (
        <p className="mt-1 text-xs text-amber-700">
          Has alcanzado el limite de {label.toLowerCase()}.
        </p>
      )}
    </div>
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
function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}
function Item({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="font-medium text-slate-950">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}
function money(value: string | number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(Number(value));
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-DO') : 'N/D';
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-DO');
}
function daysRemaining(value: string, now: number) {
  return `${Math.max(
    0,
    Math.ceil((new Date(value).getTime() - now) / 86_400_000),
  )} dias`;
}
function limitText(limit: number | null, label: string) {
  return limit === null ? `${label} personalizadas` : `${limit} ${label}`;
}

function initialPayPalReturnMessage() {
  if (typeof window === 'undefined') return '';
  const paypalStatus = new URLSearchParams(window.location.search).get(
    'paypal',
  );
  if (paypalStatus === 'cancel')
    return 'Cancelaste el checkout en PayPal. No se aplico ningun pago.';
  if (paypalStatus === 'return') return 'Confirmando pago con PayPal...';
  return '';
}

function initialPayPalReturnError() {
  if (typeof window === 'undefined') return '';
  const query = new URLSearchParams(window.location.search);
  return query.get('paypal') === 'return' && !query.get('checkoutSessionId')
    ? 'No se pudo identificar el checkout devuelto por PayPal.'
    : '';
}
