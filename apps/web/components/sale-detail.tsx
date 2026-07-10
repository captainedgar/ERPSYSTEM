'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { currency, Status } from '@/components/sales-manager';
import {
  createInternalDocumentFromSale,
  InternalDocumentStatus,
  InternalDocumentType,
  listSaleInternalDocuments,
  type InternalDocument,
} from '@/lib/internal-documents';
import { cancelSale, getSale, SaleStatus, type Sale } from '@/lib/sales';

export function SaleDetail({ saleId }: { saleId: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [documents, setDocuments] = useState<InternalDocument[]>([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [creatingDocument, setCreatingDocument] =
    useState<InternalDocumentType | null>(null);
  const [error, setError] = useState('');

  const canView = [
    'OWNER',
    'ADMIN',
    'CASHIER',
    'SELLER',
    'ACCOUNTING',
  ].includes(user?.role.code ?? '');
  const canCancel = ['OWNER', 'ADMIN'].includes(user?.role.code ?? '');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await getSale(saleId);
        const saleDocuments = await listSaleInternalDocuments(saleId);
        if (!cancelled) {
          setSale(response);
          setDocuments(saleDocuments);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la venta',
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
  }, [canView, saleId, user]);

  async function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sale) return;
    setCancelling(true);
    setError('');
    try {
      setSale(await cancelSale(sale.id, reason));
      setReason('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo anular la venta',
      );
    } finally {
      setCancelling(false);
    }
  }

  async function createDocument(documentType: InternalDocumentType) {
    if (!sale) return;
    setCreatingDocument(documentType);
    setError('');
    try {
      const document = await createInternalDocumentFromSale(
        sale.id,
        documentType,
      );
      setDocuments((current) => [document, ...current]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo generar el documento interno',
      );
    } finally {
      setCreatingDocument(null);
    }
  }

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando detalle…
      </main>
    );
  }
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center">
        Redirigiendo al acceso…
      </main>
    );
  }
  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center">
        No tienes permiso para consultar ventas.
      </main>
    );
  }
  if (!sale) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <p className="text-rose-300">{error || 'Venta no encontrada'}</p>
          <Link className="mt-4 inline-block text-blue-600" href="/sales">
            Volver a ventas
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Detalle de venta
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{sale.saleNumber}</h1>
              <Status status={sale.status} />
            </div>
            <p className="mt-2 text-slate-500">
              {new Date(sale.createdAt).toLocaleString('es-DO')} ·{' '}
              {sale.branch?.name} · {sale.createdBy.name}
            </p>
          </div>
          <Link className="text-sm text-slate-600" href="/sales">
            Volver a ventas
          </Link>
        </header>

        {error && (
          <div
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Artículos</h2>
            <div className="mt-4 grid gap-3">
              {sale.items?.map((item) => (
                <article
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto]"
                  key={item.id}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {Number(item.quantity)} ×{' '}
                      {currency(Number(item.unitPrice))} · ITBIS{' '}
                      {Number(item.taxRate)}%
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">
                      {currency(Number(item.total))}
                    </p>
                    {Number(item.discountAmount) > 0 && (
                      <p className="text-xs text-slate-500">
                        Descuento {currency(Number(item.discountAmount))}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <h2 className="mt-8 text-xl font-semibold">Pagos</h2>
            <div className="mt-4 grid gap-3">
              {sale.payments?.map((payment) => (
                <article
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  key={payment.id}
                >
                  <div>
                    <p className="font-medium">
                      {paymentMethodLabel(payment.method)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {payment.reference || 'Sin referencia'}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {currency(Number(payment.amount))}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Resumen</h2>
            <p className="mt-4 text-sm text-slate-500">Cliente</p>
            <p>{sale.customer?.name ?? 'Consumidor final'}</p>
            {sale.customer?.documentNumber && (
              <p className="text-sm text-slate-500">
                {sale.customer.documentNumber}
              </p>
            )}
            {sale.cashSessionId && (
              <Link
                className="mt-3 inline-block text-sm text-blue-600"
                href={`/cash/sessions/${sale.cashSessionId}`}
              >
                Ver caja asociada
              </Link>
            )}
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="font-semibold">Documentos internos</h3>
              <div className="mt-3 grid gap-2">
                {documents.length ? (
                  documents.map((document) => (
                    <Link
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition hover:border-blue-300"
                      href={`/internal-documents/${document.id}`}
                      key={document.id}
                    >
                      <span className="font-medium">
                        {document.documentNumber}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {documentTypeLabel(document.documentType)} ·{' '}
                        {document.status === InternalDocumentStatus.ISSUED
                          ? 'Emitido'
                          : 'Anulado'}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Esta venta no tiene documentos internos.
                  </p>
                )}
              </div>
              {sale.status === SaleStatus.COMPLETED && (
                <div className="mt-4 grid gap-2">
                  <Button
                    disabled={creatingDocument !== null}
                    onClick={() =>
                      void createDocument(InternalDocumentType.RECEIPT)
                    }
                    type="button"
                    variant="secondary"
                  >
                    {creatingDocument === InternalDocumentType.RECEIPT
                      ? 'Generando...'
                      : 'Generar recibo interno'}
                  </Button>
                  <Button
                    disabled={creatingDocument !== null}
                    onClick={() =>
                      void createDocument(InternalDocumentType.INTERNAL_INVOICE)
                    }
                    type="button"
                    variant="secondary"
                  >
                    {creatingDocument === InternalDocumentType.INTERNAL_INVOICE
                      ? 'Generando...'
                      : 'Generar factura interna'}
                  </Button>
                  <Link
                    className="text-center text-sm text-blue-600"
                    href={`/internal-documents?saleId=${sale.id}`}
                  >
                    Ver documentos internos
                  </Link>
                </div>
              )}
            </div>
            <dl className="mt-5 grid gap-2 border-t border-slate-200 pt-4 text-sm">
              <Row label="Subtotal" value={Number(sale.subtotal)} />
              <Row label="Descuento" value={-Number(sale.discountTotal)} />
              <Row label="ITBIS" value={Number(sale.taxTotal)} />
              <Row label="Pagado" value={Number(sale.paidTotal)} />
              <Row label="Balance" value={Number(sale.balanceDue)} />
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-lg font-semibold">
                <dt>Total</dt>
                <dd>{currency(Number(sale.total))}</dd>
              </div>
            </dl>

            {sale.status === SaleStatus.CANCELLED && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                <p className="font-semibold">Venta anulada</p>
                <p className="mt-1">{sale.cancelReason}</p>
                {sale.cancelledAt && (
                  <p className="mt-2 text-xs text-rose-300">
                    {new Date(sale.cancelledAt).toLocaleString('es-DO')}
                    {sale.cancelledBy ? ` · ${sale.cancelledBy.name}` : ''}
                  </p>
                )}
              </div>
            )}

            {canCancel && sale.status === SaleStatus.COMPLETED && (
              <form
                className="mt-6 border-t border-slate-200 pt-5"
                onSubmit={(event) => void submitCancel(event)}
              >
                <label>
                  Motivo de anulación
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-950"
                    maxLength={500}
                    minLength={3}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <Button
                  className="mt-3 w-full"
                  disabled={cancelling}
                  type="submit"
                  variant="secondary"
                >
                  {cancelling ? 'Anulando…' : 'Anular venta'}
                </Button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function documentTypeLabel(type: string) {
  return type === 'RECEIPT' ? 'Recibo' : 'Factura interna';
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-600">
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
    CREDIT: 'Crédito',
  }[method];
}
