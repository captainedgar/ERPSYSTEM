'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { currency } from '@/components/sales-manager';
import {
  getInternalDocumentPrintData,
  InternalDocumentType,
  type InternalDocumentPrintData,
} from '@/lib/internal-documents';
import { hasPermission } from '@/lib/permissions';

export function InternalDocumentPrint({ id }: { id: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [data, setData] = useState<InternalDocumentPrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canPrint = hasPermission(user, 'internal_documents.print');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canPrint) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await getInternalDocumentPrintData(id);
        if (!cancelled) setData(response);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la vista imprimible',
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
  }, [canPrint, id, user]);

  if (authLoading || (canPrint && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando impresion...
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Redirigiendo al acceso...
      </main>
    );
  }
  if (!canPrint) {
    return (
      <main className="grid min-h-screen place-items-center">
        No tienes permiso para imprimir documentos internos.
      </main>
    );
  }
  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <p className="text-rose-300">
            {error || 'Documento interno no encontrado'}
          </p>
          <Link
            className="mt-4 inline-block text-blue-600"
            href="/internal-documents"
          >
            Volver a documentos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-200 px-5 py-8 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-4xl justify-between print:hidden">
        <Link className="text-slate-700" href={`/internal-documents/${id}`}>
          Volver
        </Link>
        <Button type="button" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 shadow-xl print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {data.company.legalName || data.company.name}
              </h1>
              {data.company.rncOrCedula && (
                <p className="mt-1 text-sm">
                  RNC/Cedula: {data.company.rncOrCedula}
                </p>
              )}
              <p className="mt-1 text-sm">{data.company.address}</p>
              <p className="text-sm">{data.company.phone}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm tracking-wide uppercase">
                {data.document.documentType === InternalDocumentType.RECEIPT
                  ? 'Recibo interno'
                  : 'Factura interna'}
              </p>
              <p className="mt-1 text-xl font-bold">
                {data.document.documentNumber}
              </p>
              <p className="mt-1 text-sm">
                {new Date(data.document.createdAt).toLocaleString('es-DO')}
              </p>
            </div>
          </div>
          <div className="mt-5 border border-amber-700 bg-amber-50 p-3 text-center text-sm font-semibold text-amber-950">
            {data.disclaimer}
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase">Sucursal</h2>
            <p className="mt-1">{data.branch.name}</p>
            <p className="text-sm text-slate-600">{data.branch.address}</p>
            <p className="text-sm text-slate-600">{data.branch.phone}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase">Cliente</h2>
            <p className="mt-1">{data.customer?.name ?? 'Consumidor final'}</p>
            {data.customer?.documentNumber && (
              <p className="text-sm text-slate-600">
                Documento: {data.customer.documentNumber}
              </p>
            )}
            <p className="text-sm text-slate-600">
              Venta: {data.document.sale.saleNumber}
            </p>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2 text-right">Precio</th>
              <th className="py-2 text-right">ITBIS</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr className="border-b border-slate-200" key={item.id}>
                <td className="py-2">{item.name}</td>
                <td className="py-2 text-right">{Number(item.quantity)}</td>
                <td className="py-2 text-right">
                  {currency(Number(item.unitPrice))}
                </td>
                <td className="py-2 text-right">
                  {currency(Number(item.taxTotal))}
                </td>
                <td className="py-2 text-right">
                  {currency(Number(item.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 grid gap-6 sm:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-sm font-semibold uppercase">Pagos</h2>
            <div className="mt-2 grid gap-1 text-sm">
              {data.payments.length ? (
                data.payments.map((payment) => (
                  <div className="flex justify-between" key={payment.id}>
                    <span>{paymentMethodLabel(payment.method)}</span>
                    <span>{currency(Number(payment.amount))}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Sin pagos registrados.</p>
              )}
            </div>
          </div>
          <dl className="grid gap-2 text-sm">
            <Row label="Subtotal" value={Number(data.totals.subtotal)} />
            <Row label="Descuento" value={-Number(data.totals.discountTotal)} />
            <Row label="ITBIS" value={Number(data.totals.taxTotal)} />
            <Row label="Pagado" value={Number(data.totals.paidTotal)} />
            <Row label="Balance" value={Number(data.totals.balanceDue)} />
            <div className="mt-2 flex justify-between border-t border-slate-300 pt-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{currency(Number(data.totals.total))}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-4 text-center text-xs text-slate-600">
          {data.disclaimer}
        </footer>
      </article>
    </main>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{currency(value)}</dd>
    </div>
  );
}

function paymentMethodLabel(method: string) {
  return {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    CREDIT: 'Credito',
  }[method];
}
