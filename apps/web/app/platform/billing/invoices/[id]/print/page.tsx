'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  PlatformInvoiceStatusBadge,
  platformErrorClass,
  platformErrorMessage,
  platformMoney,
} from '@/components/platform-ui';
import {
  getSubscriptionInvoice,
  type SubscriptionInvoice,
} from '@/lib/platform';

export default function PlatformInvoicePrintPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<SubscriptionInvoice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextInvoice = await getSubscriptionInvoice(params.id);
        if (!cancelled) setInvoice(nextInvoice);
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

  if (!invoice && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-white text-slate-700">
        Cargando factura...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-8 py-10 text-slate-950 print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        {error && <p className={platformErrorClass}>{error}</p>}
        {invoice && (
          <article className="rounded-lg border border-slate-200 bg-white p-8 print:border-0">
            <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div>
                <p className="text-sm font-semibold text-blue-700">
                  Comercia ERP
                </p>
                <h1 className="mt-1 text-3xl font-semibold">
                  Factura interna de suscripcion
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {invoice.invoiceNumber}
                </p>
              </div>
              <PlatformInvoiceStatusBadge status={invoice.status} />
            </header>

            <section className="mt-8 grid gap-6 md:grid-cols-2">
              <Info
                label="Empresa cliente"
                value={invoice.company?.name ?? 'N/D'}
              />
              <Info label="Plan" value={invoice.plan.name} />
              <Info
                label="Periodo"
                value={`${formatDate(invoice.billingPeriodStart)} - ${formatDate(
                  invoice.billingPeriodEnd,
                )}`}
              />
              <Info label="Vencimiento" value={formatDate(invoice.dueDate)} />
            </section>

            <section className="mt-8 rounded-lg border border-slate-200">
              <Row label="Subtotal" value={platformMoney(invoice.subtotal)} />
              <Row label="ITBIS" value={platformMoney(invoice.taxAmount)} />
              <Row
                label="Descuento"
                value={platformMoney(invoice.discountAmount)}
              />
              <Row label="Total" strong value={platformMoney(invoice.total)} />
              <Row label="Pagado" value={platformMoney(invoice.amountPaid)} />
              <Row
                label="Balance"
                strong
                value={platformMoney(invoice.balance)}
              />
            </section>

            <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              Documento interno de cobro SaaS. No valido como comprobante
              fiscal.
            </p>
          </article>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className="mt-1 font-medium text-slate-950">{value}</p>
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-DO');
}
