'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  createInventoryAdjustment,
  createManualEntry,
  getInventory,
  getLowStockInventory,
  InventoryMovementType,
  type InventoryListResponse,
  type InventoryProduct,
} from '@/lib/inventory';

type InventoryMode = 'all' | 'low-stock';

interface MovementFormState {
  productId: string;
  productName: string;
  action: 'manual-entry' | 'adjustment-in' | 'adjustment-out';
  quantity: string;
  unitCost: string;
  reason: string;
}

const emptyMovementForm: MovementFormState = {
  productId: '',
  productName: '',
  action: 'manual-entry',
  quantity: '1',
  unitCost: '',
  reason: '',
};

export function InventoryManager({ mode }: { mode: InventoryMode }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [response, setResponse] = useState<InventoryListResponse | null>(null);
  const [form, setForm] = useState(emptyMovementForm);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(mode === 'low-stock');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void loadInventory(search, mode === 'low-stock' ? true : onlyLowStock);
    // Inventory data is intentionally reloaded only for the active filters and user context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlyLowStock, search, user]);

  async function loadInventory(currentSearch = '', lowStock = onlyLowStock) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (currentSearch.trim()) params.set('search', currentSearch.trim());
      if (lowStock) params.set('lowStock', 'true');
      const nextResponse =
        mode === 'low-stock'
          ? await getLowStockInventory(params)
          : await getInventory(params);
      setResponse(nextResponse);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar el inventario.',
      );
    } finally {
      setLoading(false);
    }
  }

  function openAction(
    product: InventoryProduct,
    action: MovementFormState['action'],
  ) {
    setForm({
      productId: product.id,
      productName: product.name,
      action,
      quantity: '1',
      unitCost: '',
      reason: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.productId) return;

    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (form.action === 'manual-entry') {
        await createManualEntry(form.productId, {
          quantity: Number(form.quantity),
          unitCost: form.unitCost ? Number(form.unitCost) : undefined,
          reason: form.reason.trim(),
        });
        setMessage(`Entrada manual registrada para ${form.productName}.`);
      } else {
        await createInventoryAdjustment(form.productId, {
          type:
            form.action === 'adjustment-in'
              ? InventoryMovementType.ADJUSTMENT_IN
              : InventoryMovementType.ADJUSTMENT_OUT,
          quantity: Number(form.quantity),
          reason: form.reason.trim(),
        });
        setMessage(`Ajuste registrado para ${form.productName}.`);
      }
      setForm(emptyMovementForm);
      await loadInventory(search, mode === 'low-stock' ? true : onlyLowStock);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo registrar el movimiento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando…</main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <p className="text-lg font-medium">Necesitas iniciar sesión.</p>
          <p className="mt-2 text-sm text-slate-400">
            Redirigiendo al acceso del sistema…
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando…</main>
    );
  }

  const items = response?.items ?? [];

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Inventario · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {mode === 'low-stock' ? 'Productos bajo mínimo' : 'Inventario'}
            </h1>
            <p className="mt-2 text-slate-400">
              Controla existencias, ajustes y entradas manuales por producto.
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link className="text-slate-300 hover:text-white" href="/dashboard">
              Volver al panel
            </Link>
            {mode === 'low-stock' ? (
              <Link
                className="text-emerald-400 hover:text-emerald-300"
                href="/inventory"
              >
                Ver inventario completo
              </Link>
            ) : (
              <Link
                className="text-emerald-400 hover:text-emerald-300"
                href="/inventory/low-stock"
              >
                Ver bajo stock
              </Link>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            className="h-fit rounded-3xl border border-slate-800 bg-slate-950 p-6"
            onSubmit={(event) => void submit(event)}
          >
            <h2 className="text-xl font-semibold">Registrar movimiento</h2>
            <p className="mt-2 text-sm text-slate-400">
              {form.productId
                ? `Producto seleccionado: ${form.productName}`
                : 'Selecciona una acción desde la lista para completar el movimiento.'}
            </p>
            <div className="mt-5 grid gap-4">
              <label>
                Tipo
                <select
                  disabled={!form.productId}
                  value={form.action}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      action: event.target.value as MovementFormState['action'],
                    }))
                  }
                >
                  <option value="manual-entry">Entrada manual</option>
                  <option value="adjustment-in">Ajuste positivo</option>
                  <option value="adjustment-out">Ajuste negativo</option>
                </select>
              </label>
              <label>
                Cantidad
                <input
                  disabled={!form.productId}
                  min="0.001"
                  required
                  step="0.001"
                  type="number"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </label>
              {form.action === 'manual-entry' && (
                <label>
                  Costo unitario opcional
                  <input
                    disabled={!form.productId}
                    min="0"
                    step="0.01"
                    type="number"
                    value={form.unitCost}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unitCost: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <label>
                Motivo
                <textarea
                  className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white"
                  disabled={!form.productId}
                  maxLength={500}
                  required
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
            {message && (
              <p className="mt-4 text-sm text-emerald-400">{message}</p>
            )}
            <div className="mt-5 flex gap-2">
              <Button disabled={submitting || !form.productId} type="submit">
                {submitting ? 'Guardando…' : 'Guardar movimiento'}
              </Button>
              {form.productId && (
                <Button
                  onClick={() => setForm(emptyMovementForm)}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>

          <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void loadInventory(
                  search,
                  mode === 'low-stock' ? true : onlyLowStock,
                );
              }}
            >
              <input
                placeholder="Buscar por nombre, SKU o código de barra…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {mode !== 'low-stock' && (
                <label className="flex items-center gap-2 rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300">
                  <input
                    checked={onlyLowStock}
                    onChange={(event) => setOnlyLowStock(event.target.checked)}
                    type="checkbox"
                  />
                  Solo bajo stock
                </label>
              )}
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>

            <div className="mt-5 grid gap-3">
              {error && !items.length && (
                <div className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
                  <p>{error}</p>
                  <Button
                    className="mt-3"
                    onClick={() =>
                      void loadInventory(
                        search,
                        mode === 'low-stock' ? true : onlyLowStock,
                      )
                    }
                    type="button"
                    variant="secondary"
                  >
                    Reintentar
                  </Button>
                </div>
              )}
              {!items.length && (
                <p className="py-8 text-center text-slate-500">
                  No hay productos para mostrar.
                </p>
              )}
              {items.map((product) => {
                const isLowStock =
                  Number(product.stock) <= Number(product.minStock);
                return (
                  <article
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                    key={product.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{product.name}</h3>
                          {isLowStock && (
                            <span className="rounded-full bg-amber-950 px-2 py-1 text-xs text-amber-300">
                              Bajo stock
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          Stock actual {Number(product.stock)} · mínimo{' '}
                          {Number(product.minStock)} ·{' '}
                          {product.unit?.name ?? 'Sin unidad'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.category?.name ?? 'Sin categoría'} ·{' '}
                          {product.brand?.name ?? 'Sin marca'}
                        </p>
                      </div>
                      <Link
                        className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                        href={`/inventory/products/${product.id}/movements`}
                      >
                        Ver movimientos
                      </Link>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={() => openAction(product, 'manual-entry')}
                        type="button"
                        variant="secondary"
                      >
                        Entrada manual
                      </Button>
                      <Button
                        onClick={() => openAction(product, 'adjustment-in')}
                        type="button"
                        variant="secondary"
                      >
                        Ajuste +
                      </Button>
                      <Button
                        onClick={() => openAction(product, 'adjustment-out')}
                        type="button"
                        variant="secondary"
                      >
                        Ajuste -
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
