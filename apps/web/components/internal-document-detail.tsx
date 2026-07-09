'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Status, TypeLabel } from '@/components/internal-documents-manager';
import { currency } from '@/components/sales-manager';
import { createElectronicInvoiceFromInternalDocument } from '@/lib/fiscal';
import {
  getInternalDocument,
  InternalDocumentStatus,
  voidInternalDocument,
  type InternalDocument,
} from '@/lib/internal-documents';

export function InternalDocumentDetail({ id }: { id: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [document, setDocument] = useState<InternalDocument | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [creatingFiscalDraft, setCreatingFiscalDraft] = useState(false);
  const [fiscalDraftId, setFiscalDraftId] = useState('');
  const [error, setError] = useState('');

  const canView = [
    'OWNER',
    'ADMIN',
    'CASHIER',
    'SELLER',
    'ACCOUNTING',
  ].includes(user?.role.code ?? '');
  const canVoid = ['OWNER', 'ADMIN', 'ACCOUNTING'].includes(
    user?.role.code ?? '',
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await getInternalDocument(id);
        if (!cancelled) setDocument(response);
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar el documento',
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
  }, [canView, id, user]);

  async function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    setVoiding(true);
    setError('');
    try {
      setDocument(await voidInternalDocument(document.id, reason));
      setReason('');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo anular el documento',
      );
    } finally {
      setVoiding(false);
    }
  }

  async function createFiscalDraft() {
    if (!document) return;
    setCreatingFiscalDraft(true);
    setError('');
    try {
      const invoice = await createElectronicInvoiceFromInternalDocument(
        document.id,
      );
      setFiscalDraftId(invoice.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo crear el borrador fiscal',
      );
    } finally {
      setCreatingFiscalDraft(false);
    }
  }

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Cargando documento...
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
  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center">
        No tienes permiso para consultar documentos internos.
      </main>
    );
  }
  if (!document) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <p className="text-rose-300">
            {error || 'Documento interno no encontrado'}
          </p>
          <Link
            className="mt-4 inline-block text-emerald-400"
            href="/internal-documents"
          >
            Volver a documentos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Documento interno no fiscal
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">
                {document.documentNumber}
              </h1>
              <Status status={document.status} />
              <TypeLabel type={document.documentType} />
            </div>
            <p className="mt-2 text-slate-400">
              Venta {document.sale.saleNumber} ·{' '}
              {new Date(document.createdAt).toLocaleString('es-DO')} ·{' '}
              {document.createdBy.name}
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link
              className="text-emerald-400"
              href={`/sales/${document.saleId}`}
            >
              Ver venta
            </Link>
            <Link
              className="text-emerald-400"
              href={`/internal-documents/${document.id}/print`}
            >
              Imprimir
            </Link>
            <Link className="text-slate-300" href="/internal-documents">
              Volver
            </Link>
          </div>
        </header>

        {error && (
          <div
            className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-xl font-semibold">Items</h2>
            <div className="mt-4 grid gap-3">
              {document.items?.map((item) => (
                <article
                  className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[1fr_auto]"
                  key={item.id}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {Number(item.quantity)} x{' '}
                      {currency(Number(item.unitPrice))} · ITBIS{' '}
                      {Number(item.taxRate)}%
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">
                      {currency(Number(item.total))}
                    </p>
                    {Number(item.discountAmount) > 0 && (
                      <p className="text-xs text-slate-400">
                        Descuento {currency(Number(item.discountAmount))}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="h-fit rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-xl font-semibold">Resumen</h2>
            <p className="mt-4 text-sm text-slate-400">Cliente</p>
            <p>{document.customer?.name ?? 'Consumidor final'}</p>
            {document.customer?.documentNumber && (
              <p className="text-sm text-slate-400">
                {document.customer.documentNumber}
              </p>
            )}
            <dl className="mt-5 grid gap-2 border-t border-slate-800 pt-4 text-sm">
              <Row label="Subtotal" value={Number(document.subtotal)} />
              <Row label="Descuento" value={-Number(document.discountTotal)} />
              <Row label="ITBIS" value={Number(document.taxTotal)} />
              <Row label="Pagado" value={Number(document.paidTotal)} />
              <Row label="Balance" value={Number(document.balanceDue)} />
              <div className="mt-2 flex justify-between border-t border-slate-800 pt-3 text-lg font-semibold">
                <dt>Total</dt>
                <dd>{currency(Number(document.total))}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-2xl border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-100">
              Documento interno no fiscal. No válido como comprobante fiscal.
            </div>

            {document.status === InternalDocumentStatus.VOIDED && (
              <div className="mt-5 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
                <p className="font-semibold">Documento anulado</p>
                <p className="mt-1">{document.voidReason}</p>
                {document.voidedAt && (
                  <p className="mt-2 text-xs text-rose-300">
                    {new Date(document.voidedAt).toLocaleString('es-DO')}
                    {document.voidedBy ? ` · ${document.voidedBy.name}` : ''}
                  </p>
                )}
              </div>
            )}

            {canVoid && document.status === InternalDocumentStatus.ISSUED && (
              <>
                <div className="mt-6 border-t border-slate-800 pt-5">
                  <Button
                    className="w-full"
                    disabled={creatingFiscalDraft}
                    onClick={() => void createFiscalDraft()}
                    type="button"
                    variant="secondary"
                  >
                    {creatingFiscalDraft
                      ? 'Creando...'
                      : 'Crear borrador fiscal'}
                  </Button>
                  {fiscalDraftId && (
                    <Link
                      className="mt-3 block text-center text-sm text-emerald-400"
                      href={`/fiscal/electronic-invoices/${fiscalDraftId}`}
                    >
                      Ver borrador fiscal
                    </Link>
                  )}
                </div>
                <form
                  className="mt-6 border-t border-slate-800 pt-5"
                  onSubmit={(event) => void submitVoid(event)}
                >
                  <label>
                    Motivo de anulacion
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                      maxLength={500}
                      minLength={3}
                      required
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <Button
                    className="mt-3 w-full"
                    disabled={voiding}
                    type="submit"
                    variant="secondary"
                  >
                    {voiding ? 'Anulando...' : 'Anular documento'}
                  </Button>
                </form>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-300">
      <dt>{label}</dt>
      <dd>{currency(value)}</dd>
    </div>
  );
}
