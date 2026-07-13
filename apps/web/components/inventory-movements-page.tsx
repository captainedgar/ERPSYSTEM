'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  getProductStockByBranch,
  getInventoryMovements,
  type BranchStockItem,
  type InventoryMovementsResponse,
} from '@/lib/inventory';

export function InventoryMovementsPage({ productId }: { productId: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [response, setResponse] = useState<InventoryMovementsResponse | null>(
    null,
  );
  const [branchStock, setBranchStock] = useState<BranchStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void load();
    // The current product id and authenticated user fully determine this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '50');
      const [movements, stock] = await Promise.all([
        getInventoryMovements(productId, params),
        getProductStockByBranch(productId),
      ]);
      setResponse(movements);
      setBranchStock(stock.items);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar el historial de movimientos.',
      );
    } finally {
      setLoading(false);
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
          <p className="mt-2 text-sm text-slate-500">
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

  if (!response) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-rose-400">
            {error || 'No se pudo cargar el historial del producto.'}
          </p>
          <Button
            className="mt-4"
            onClick={() => void load()}
            type="button"
            variant="secondary"
          >
            Reintentar
          </Button>
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
              Inventario · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Movimientos de {response.product.name}
            </h1>
            <p className="mt-2 text-slate-500">
              Stock actual {Number(response.product.stock)} · mínimo{' '}
              {Number(response.product.minStock)}
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link
              className="text-slate-600 hover:text-slate-950"
              href="/inventory"
            >
              Volver a inventario
            </Link>
            <Link
              className="text-blue-600 hover:text-blue-700"
              href="/inventory/low-stock"
            >
              Ver bajo stock
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <p>{error}</p>
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Stock por sucursal</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {branchStock.map((item) => (
              <div
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                key={item.branch.id}
              >
                <p className="font-semibold">{item.branch.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Disponible {Number(item.quantity)} · mínimo{' '}
                  {Number(item.minStock)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          {!response.items.length && (
            <p className="py-8 text-center text-slate-500">
              Aún no hay movimientos para este producto.
            </p>
          )}
          <div className="grid gap-3">
            {response.items.map((movement) => (
              <article
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                key={movement.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{movement.type}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Cantidad {Number(movement.quantity)} · stock anterior{' '}
                      {Number(movement.previousStock)} · stock nuevo{' '}
                      {Number(movement.newStock)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {movement.reason}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{new Date(movement.createdAt).toLocaleString()}</p>
                    <p className="mt-1">
                      {movement.createdBy?.name ?? 'Usuario no disponible'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
