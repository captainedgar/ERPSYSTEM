'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  getInventoryMovements,
  type InventoryMovementsResponse,
} from '@/lib/inventory';

export function InventoryMovementsPage({ productId }: { productId: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [response, setResponse] = useState<InventoryMovementsResponse | null>(
    null,
  );
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
      setResponse(await getInventoryMovements(productId, params));
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
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Inventario · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Movimientos de {response.product.name}
            </h1>
            <p className="mt-2 text-slate-400">
              Stock actual {Number(response.product.stock)} · mínimo{' '}
              {Number(response.product.minStock)}
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link className="text-slate-300 hover:text-white" href="/inventory">
              Volver a inventario
            </Link>
            <Link
              className="text-emerald-400 hover:text-emerald-300"
              href="/inventory/low-stock"
            >
              Ver bajo stock
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
            <p>{error}</p>
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
          {!response.items.length && (
            <p className="py-8 text-center text-slate-500">
              Aún no hay movimientos para este producto.
            </p>
          )}
          <div className="grid gap-3">
            {response.items.map((movement) => (
              <article
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                key={movement.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{movement.type}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Cantidad {Number(movement.quantity)} · stock anterior{' '}
                      {Number(movement.previousStock)} · stock nuevo{' '}
                      {Number(movement.newStock)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {movement.reason}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-400">
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
