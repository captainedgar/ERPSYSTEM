'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { CustomerStatus, listCustomers, type Customer } from '@/lib/customers';
import {
  PosItemType,
  PosSearchType,
  searchPosItems,
  validateCart,
  type CartValidationResponse,
  type PosItem,
} from '@/lib/pos';
import { addPosItemToCart, type PosCartLine } from '@/lib/pos-cart';
import { hasPermission } from '@/lib/permissions';
import {
  getPosAlternatives,
  getPosAlternativesByCode,
  type ProductAlternative,
} from '@/lib/product-compatibility';
import { createSale, PaymentMethod, type Sale } from '@/lib/sales';

type CartLine = PosCartLine;

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
}

const pageLimit = 20;
const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
};

function initialPayments(): PaymentLine[] {
  return [
    {
      id: 'initial-payment',
      method: PaymentMethod.CASH,
      amount: '',
      reference: '',
    },
  ];
}

export function PosManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [results, setResults] = useState<PosItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
  const [alternativesMessage, setAlternativesMessage] = useState('');
  const [type, setType] = useState<PosSearchType>(PosSearchType.ALL);
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [creatingSale, setCreatingSale] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>(initialPayments);
  const [createdSale, setCreatedSale] = useState<Sale | null>(null);
  const [validation, setValidation] = useState<CartValidationResponse | null>(
    null,
  );
  const scanInputRef = useRef<HTMLInputElement>(null);

  const canUsePos = hasPermission(user, 'pos.access');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canUsePos) return;
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [itemsResponse, customersResponse] = await Promise.all([
          searchPosItems({
            type: PosSearchType.ALL,
            page: 1,
            limit: pageLimit,
          }),
          listCustomers({
            status: CustomerStatus.ACTIVE,
            page: 1,
            limit: 100,
          }),
        ]);
        if (cancelled) return;
        setResults(itemsResponse.items);
        setTotalResults(itemsResponse.total);
        setPage(itemsResponse.page);
        setCustomers(customersResponse.items);
      } catch (reason) {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo preparar el POS',
        );
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [canUsePos, user]);

  useEffect(() => {
    if (!authLoading && !initializing && canUsePos) {
      scanInputRef.current?.focus();
    }
  }, [authLoading, canUsePos, initializing]);

  const totals = useMemo(
    () =>
      cart.reduce(
        (current, line) => {
          const lineSubtotal = roundMoney(
            Number(line.price) * Math.max(0, line.quantity),
          );
          const discount = line.allowDiscount
            ? Math.min(
                Math.max(0, line.discountAmount),
                Math.max(0, lineSubtotal),
              )
            : 0;
          const tax = roundMoney(
            (lineSubtotal - discount) * (Number(line.taxRate) / 100),
          );
          return {
            subtotal: roundMoney(current.subtotal + lineSubtotal),
            discount: roundMoney(current.discount + discount),
            tax: roundMoney(current.tax + tax),
            total: roundMoney(current.total + lineSubtotal - discount + tax),
          };
        },
        { subtotal: 0, discount: 0, tax: 0, total: 0 },
      ),
    [cart],
  );

  async function runSearch(nextPage = 1) {
    setSearching(true);
    setError('');
    setAlternatives([]);
    setAlternativesMessage('');
    try {
      const response = await searchPosItems({
        search: search.trim() || undefined,
        type,
        page: nextPage,
        limit: pageLimit,
      });
      setResults(response.items);
      setTotalResults(response.total);
      setPage(response.page);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo completar la búsqueda',
      );
    } finally {
      setSearching(false);
    }
  }

  function addItem(item: PosItem, showFeedback = false) {
    setValidation(null);
    setCreatedSale(null);
    const result = addPosItemToCart(cart, item);
    setCart(result.cart);
    if (showFeedback) {
      setScanFeedback({
        type: result.ok ? 'success' : 'error',
        message: result.message,
      });
    } else if (!result.ok) {
      setError(result.message);
      if (item.type === PosItemType.PRODUCT) {
        void loadAlternativesForProduct(
          item.id,
          'Alternativas compatibles con stock',
        );
      }
    }
    return result.ok;
  }

  async function loadAlternativesForProduct(
    productId: string,
    message: string,
  ) {
    try {
      const response = await getPosAlternatives(productId);
      setAlternatives(response.alternatives);
      setAlternativesMessage(response.alternatives.length ? message : '');
    } catch {
      setAlternatives([]);
      setAlternativesMessage('');
    }
  }

  async function loadAlternativesByCode(code: string) {
    try {
      const response = await getPosAlternativesByCode(code);
      setAlternatives(response.alternatives);
      setAlternativesMessage(
        response.alternatives.length
          ? 'No encontramos ese producto exacto, pero hay alternativas compatibles registradas.'
          : '',
      );
    } catch {
      setAlternatives([]);
      setAlternativesMessage('');
    }
  }

  async function submitScan() {
    const code = scanCode.trim();
    if (!code || scanning) return;

    setScanning(true);
    setError('');
    setScanFeedback(null);
    try {
      const response = await searchPosItems({
        search: code,
        type: PosSearchType.PRODUCT,
        page: 1,
        limit: 10,
      });
      const item = response.items.find(
        (candidate) =>
          candidate.type === PosItemType.PRODUCT &&
          candidate.barcode?.toLocaleLowerCase() === code.toLocaleLowerCase(),
      );
      if (!item) {
        await loadAlternativesByCode(code);
        setScanFeedback({
          type: 'error',
          message: 'No encontramos un producto con ese código.',
        });
        return;
      }
      if (addItem(item, true)) {
        setScanCode('');
        setAlternatives([]);
        setAlternativesMessage('');
      } else {
        await loadAlternativesForProduct(
          item.id,
          'Alternativas compatibles con stock',
        );
      }
    } catch (reason) {
      setScanFeedback({
        type: 'error',
        message:
          reason instanceof Error
            ? reason.message
            : 'No se pudo buscar el código escaneado.',
      });
    } finally {
      setScanning(false);
      requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  }

  function updateLine(
    line: CartLine,
    field: 'quantity' | 'discountAmount',
    value: number,
  ) {
    setValidation(null);
    setCreatedSale(null);
    setCart((current) =>
      current.map((candidate) =>
        candidate.id === line.id && candidate.type === line.type
          ? { ...candidate, [field]: value }
          : candidate,
      ),
    );
  }

  function removeLine(line: CartLine) {
    setValidation(null);
    setCreatedSale(null);
    setCart((current) =>
      current.filter(
        (candidate) => candidate.id !== line.id || candidate.type !== line.type,
      ),
    );
  }

  async function submitValidation() {
    if (!cart.length) return;
    setValidating(true);
    setError('');
    setValidation(null);
    try {
      const response = await validateCart({
        customerId: customerId || undefined,
        items: cart.map((line) => ({
          itemType: line.type,
          itemId: line.id,
          quantity: line.quantity,
          discountAmount: line.discountAmount,
        })),
      });
      setValidation(response);
      if (
        response.valid &&
        payments.length === 1 &&
        !payments[0]?.amount.trim()
      ) {
        setPayments((current) =>
          current.map((payment, index) =>
            index === 0
              ? { ...payment, amount: String(response.total) }
              : payment,
          ),
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo validar el carrito',
      );
    } finally {
      setValidating(false);
    }
  }

  function addPayment() {
    setPayments((current) => [
      ...current,
      {
        id: globalThis.crypto.randomUUID(),
        method: PaymentMethod.CASH,
        amount: '',
        reference: '',
      },
    ]);
  }

  function updatePayment(
    id: string,
    field: 'method' | 'amount' | 'reference',
    value: string,
  ) {
    setPayments((current) =>
      current.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment,
      ),
    );
  }

  async function submitSale() {
    if (!validation?.valid || !cart.length) return;
    setCreatingSale(true);
    setError('');
    try {
      const sale = await createSale({
        customerId: customerId || undefined,
        items: cart.map((line) => ({
          itemType: line.type,
          itemId: line.id,
          quantity: line.quantity,
          discountAmount: line.discountAmount,
        })),
        payments: payments.map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount),
          reference: payment.reference.trim() || undefined,
        })),
        notes: notes.trim() || undefined,
      });
      setCreatedSale(sale);
      setCart([]);
      setCustomerId('');
      setValidation(null);
      setNotes('');
      setPayments(initialPayments());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo registrar la venta',
      );
    } finally {
      setCreatingSale(false);
    }
  }

  const paymentTotal = payments.reduce(
    (total, payment) => roundMoney(total + Number(payment.amount || 0)),
    0,
  );
  const paymentsAreValid =
    payments.length > 0 &&
    payments.every(
      (payment) =>
        Number.isFinite(Number(payment.amount)) && Number(payment.amount) > 0,
    ) &&
    !!validation &&
    paymentTotal >= Number(validation.total);

  if (authLoading || (canUsePos && initializing)) {
    return (
      <main className="grid min-h-screen place-items-center">
        Preparando POS…
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

  if (!canUsePos) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Acceso no disponible</h1>
          <p className="mt-2 text-slate-500">
            Tu rol no tiene permisos para usar el POS.
          </p>
          <Link className="mt-5 inline-block text-blue-600" href="/dashboard">
            Volver al panel
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Punto de venta · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Carrito de venta</h1>
            <p className="mt-2 text-slate-500">
              Valida y registra ventas internas con su pago e inventario.
            </p>
          </div>
          <Link
            className="text-sm text-slate-600 hover:text-slate-950"
            href="/dashboard"
          >
            Volver al panel
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

        {createdSale && (
          <div
            className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
            role="status"
          >
            Venta {createdSale.saleNumber} registrada correctamente.{' '}
            <Link
              className="font-semibold underline"
              href={`/sales/${createdSale.id}`}
            >
              Ver detalle
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5">
            <form
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void submitScan();
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <span aria-hidden="true" className="text-lg">
                      ||
                    </span>
                    Escanear producto
                  </span>
                  <input
                    aria-label="Código de barras para escanear producto"
                    className="mt-2 h-12 text-lg"
                    placeholder="Código de barras"
                    ref={scanInputRef}
                    value={scanCode}
                    onChange={(event) => setScanCode(event.target.value)}
                  />
                </label>
                <Button
                  className="h-12 lg:w-36"
                  disabled={scanning || !scanCode.trim()}
                  type="submit"
                  variant="secondary"
                >
                  {scanning ? 'Buscando...' : 'Agregar'}
                </Button>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Escanea con lector USB o escribe el código y presiona Enter.
              </p>
              {scanFeedback && (
                <p
                  className={`mt-3 text-sm font-semibold ${
                    scanFeedback.type === 'success'
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                  role="status"
                >
                  {scanFeedback.message}
                </p>
              )}
            </form>

            {alternatives.length > 0 && (
              <AlternativesPanel
                alternatives={alternatives}
                message={alternativesMessage}
                onAdd={(item) => addItem(alternativeToPosItem(item), true)}
              />
            )}

            <form
              className="mt-5 grid gap-3 sm:grid-cols-[1fr_170px_auto]"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void runSearch(1);
              }}
            >
              <input
                aria-label="Buscar productos y servicios"
                placeholder="Nombre, descripción, SKU o código de barra…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Tipo de artículo"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as PosSearchType)
                }
              >
                <option value={PosSearchType.ALL}>Todos</option>
                <option value={PosSearchType.PRODUCT}>Productos</option>
                <option value={PosSearchType.SERVICE}>Servicios</option>
              </select>
              <Button disabled={searching} type="submit" variant="secondary">
                {searching ? 'Buscando…' : 'Buscar'}
              </Button>
            </form>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {searching ? (
                <p className="col-span-full py-10 text-center text-slate-500">
                  Buscando artículos…
                </p>
              ) : !results.length ? (
                <p className="col-span-full py-10 text-center text-slate-500">
                  No hay productos o servicios para esta búsqueda.
                </p>
              ) : (
                results.map((item) => (
                  <PosResultCard
                    item={item}
                    key={`${item.type}:${item.id}`}
                    onAdd={addItem}
                    onViewAlternatives={(product) =>
                      void loadAlternativesForProduct(
                        product.id,
                        'Alternativas compatibles con stock',
                      )
                    }
                  />
                ))
              )}
            </div>

            {!searching && totalResults > 0 && (
              <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
                <span>
                  Página {page} de{' '}
                  {Math.max(1, Math.ceil(totalResults / pageLimit))}
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={page <= 1}
                    onClick={() => void runSearch(page - 1)}
                    type="button"
                    variant="secondary"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={page * pageLimit >= totalResults}
                    onClick={() => void runSearch(page + 1)}
                    type="button"
                    variant="secondary"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="h-fit rounded-3xl border border-slate-200 bg-white p-5 xl:sticky xl:top-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Carrito ({cart.length})</h2>
              {cart.length > 0 && (
                <button
                  className="text-sm text-slate-500 hover:text-slate-950"
                  onClick={() => {
                    setCart([]);
                    setValidation(null);
                    setCreatedSale(null);
                  }}
                  type="button"
                >
                  Vaciar
                </button>
              )}
            </div>

            <label className="mt-4">
              Cliente
              <select
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setValidation(null);
                  setCreatedSale(null);
                }}
              >
                <option value="">Consumidor final / sin cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.documentNumber
                      ? ` · ${customer.documentNumber}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid max-h-[45vh] gap-3 overflow-y-auto pr-1">
              {!cart.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Agrega productos o servicios desde los resultados.
                </div>
              ) : (
                cart.map((line) => (
                  <CartLineEditor
                    key={`${line.type}:${line.id}`}
                    line={line}
                    onRemove={removeLine}
                    onUpdate={updateLine}
                  />
                ))
              )}
            </div>

            <Totals totals={totals} />

            {validation && <ValidationNotice validation={validation} />}

            {validation?.valid && (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Pagos</h3>
                  <button
                    className="text-sm text-blue-600 hover:text-blue-700"
                    onClick={addPayment}
                    type="button"
                  >
                    Agregar pago
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  {payments.map((payment) => (
                    <div
                      className="grid gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-2"
                      key={payment.id}
                    >
                      <label>
                        Método
                        <select
                          value={payment.method}
                          onChange={(event) =>
                            updatePayment(
                              payment.id,
                              'method',
                              event.target.value,
                            )
                          }
                        >
                          {Object.values(PaymentMethod).map((method) => (
                            <option key={method} value={method}>
                              {paymentLabels[method]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Monto
                        <input
                          min="0.01"
                          step="0.01"
                          type="number"
                          value={payment.amount}
                          onChange={(event) =>
                            updatePayment(
                              payment.id,
                              'amount',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="sm:col-span-2">
                        Referencia (opcional)
                        <input
                          value={payment.reference}
                          onChange={(event) =>
                            updatePayment(
                              payment.id,
                              'reference',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      {payments.length > 1 && (
                        <button
                          className="text-left text-xs text-rose-300 hover:text-rose-200 sm:col-span-2"
                          onClick={() =>
                            setPayments((current) =>
                              current.filter(
                                (candidate) => candidate.id !== payment.id,
                              ),
                            )
                          }
                          type="button"
                        >
                          Quitar pago
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-right text-sm text-slate-500">
                  Pagos: {currency(paymentTotal)}
                </p>
                <label className="mt-3">
                  Notas (opcional)
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
              </div>
            )}

            <Button
              className="mt-5 w-full"
              disabled={!cart.length || validating}
              onClick={() => void submitValidation()}
              type="button"
            >
              {validating ? 'Validando…' : 'Validar carrito'}
            </Button>
            <Button
              className="mt-2 w-full"
              disabled={!validation?.valid || !paymentsAreValid || creatingSale}
              onClick={() => void submitSale()}
              type="button"
              variant="secondary"
            >
              {creatingSale ? 'Registrando venta…' : 'Finalizar venta'}
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}

function PosResultCard({
  item,
  onAdd,
  onViewAlternatives,
}: {
  item: PosItem;
  onAdd: (item: PosItem) => void;
  onViewAlternatives?: (item: PosItem) => void;
}) {
  const canShowAlternatives =
    item.type === PosItemType.PRODUCT &&
    item.trackInventory &&
    Number(item.stock) <= 0;

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase">
              {item.type === PosItemType.PRODUCT ? 'Producto' : 'Servicio'}
            </span>
            <h3 className="mt-1 font-semibold">{item.name}</h3>
          </div>
          <span className="font-semibold">{currency(Number(item.price))}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">
          {item.description || item.category?.name || 'Sin descripción'}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          {item.sku || item.barcode || item.category?.name || 'Sin código'}
          {item.type === PosItemType.PRODUCT && item.trackInventory
            ? ` · Stock ${Number(item.stock)}`
            : ''}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1"
          onClick={() => onAdd(item)}
          type="button"
          variant="secondary"
        >
          Agregar
        </Button>
        {canShowAlternatives && onViewAlternatives && (
          <Button
            className="flex-1"
            onClick={() => onViewAlternatives(item)}
            type="button"
            variant="secondary"
          >
            Ver alternativas
          </Button>
        )}
      </div>
    </article>
  );
}

function AlternativesPanel({
  alternatives,
  message,
  onAdd,
}: {
  alternatives: ProductAlternative[];
  message: string;
  onAdd: (item: ProductAlternative) => void;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div>
        <h2 className="font-semibold text-slate-950">
          Alternativas compatibles con stock
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {message ||
            'Estas alternativas fueron registradas como compatibles en el catalogo.'}
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {alternatives.map((item) => (
          <article
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            key={item.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.sku ?? item.barcode ?? 'Sin codigo'} /{' '}
                  {item.brand?.name ?? 'Sin marca'}
                </p>
              </div>
              <p className="font-semibold">{currency(Number(item.price))}</p>
            </div>
            <p className="mt-2 text-xs text-blue-700">{item.reason}</p>
            <p className="mt-1 text-sm text-slate-600">
              Stock {Number(item.stock)}
            </p>
            <Button
              className="mt-3 w-full"
              onClick={() => onAdd(item)}
              type="button"
              variant="secondary"
            >
              Agregar
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function CartLineEditor({
  line,
  onRemove,
  onUpdate,
}: {
  line: CartLine;
  onRemove: (line: CartLine) => void;
  onUpdate: (
    line: CartLine,
    field: 'quantity' | 'discountAmount',
    value: number,
  ) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{line.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {currency(Number(line.price))} · ITBIS {Number(line.taxRate)}%
          </p>
        </div>
        <button
          className="text-xs text-rose-300 hover:text-rose-200"
          onClick={() => onRemove(line)}
          type="button"
        >
          Quitar
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label>
          Cantidad
          <input
            min="0.001"
            step="0.001"
            type="number"
            value={line.quantity}
            onChange={(event) =>
              onUpdate(line, 'quantity', Number(event.target.value))
            }
          />
        </label>
        <label>
          Descuento
          <input
            disabled={!line.allowDiscount}
            min="0"
            step="0.01"
            type="number"
            value={line.discountAmount}
            onChange={(event) =>
              onUpdate(line, 'discountAmount', Number(event.target.value))
            }
          />
        </label>
      </div>
    </article>
  );
}

function Totals({
  totals,
}: {
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}) {
  return (
    <dl className="mt-5 grid gap-2 border-t border-slate-200 pt-4 text-sm">
      <TotalRow label="Subtotal" value={totals.subtotal} />
      <TotalRow label="Descuento" value={-totals.discount} />
      <TotalRow label="ITBIS" value={totals.tax} />
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-semibold">
        <dt>Total</dt>
        <dd>{currency(totals.total)}</dd>
      </div>
    </dl>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-slate-600">
      <dt>{label}</dt>
      <dd>{currency(value)}</dd>
    </div>
  );
}

function ValidationNotice({
  validation,
}: {
  validation: CartValidationResponse;
}) {
  return (
    <div
      className={`mt-5 rounded-2xl border p-4 text-sm ${
        validation.valid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
      role="status"
    >
      <p className="font-semibold">
        {validation.valid
          ? 'Carrito válido. Confirma los pagos para finalizar.'
          : 'El carrito necesita correcciones.'}
      </p>
      {validation.errors.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {validation.errors.map((item, index) => (
            <li key={`${item.code}:${item.itemId ?? index}`}>{item.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function alternativeToPosItem(item: ProductAlternative): PosItem {
  return {
    id: item.id,
    type: PosItemType.PRODUCT,
    name: item.name,
    description: item.reason,
    sku: item.sku,
    barcode: item.barcode,
    price: item.price,
    taxRate: item.taxRate,
    stock: item.stock,
    trackInventory: item.trackInventory,
    allowDiscount: item.allowDiscount,
    status: 'ACTIVE',
    category: null,
    brand: item.brand,
    unit: null,
  };
}
