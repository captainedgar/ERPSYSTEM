'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getInventoryTransfer, type InventoryTransfer } from '@/lib/inventory';
import { hasPermission } from '@/lib/permissions';

export function InventoryTransferDetail({
  transferId,
}: {
  transferId: string;
}) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [transfer, setTransfer] = useState<InventoryTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'inventory.transfer');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    void getInventoryTransfer(transferId)
      .then((response) => {
        if (!cancelled) setTransfer(response);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la informacion.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, transferId, user]);

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="font-semibold text-slate-950">Transferencia</p>
          <p className="mt-2 text-sm text-slate-600">
            No tienes permiso para realizar esta accion.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Inventario / Transferencias
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">
              Detalle de transferencia
            </h1>
            <p className="mt-2 text-slate-500">
              Si el modelo esta cancelado se muestra su estado; no hay endpoint
              de cancelacion en esta fase.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-blue-700"
            href="/inventory/transfers"
          >
            Volver a transferencias
          </Link>
        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {!transfer ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No hay datos disponibles.
          </section>
        ) : (
          <div className="mt-6 grid gap-6">
            <section className="grid gap-4 md:grid-cols-4">
              <InfoCard label="Estado" value={transfer.status} />
              <InfoCard label="Origen" value={transfer.fromBranch.name} />
              <InfoCard label="Destino" value={transfer.toBranch.name} />
              <InfoCard
                label="Fecha"
                value={new Date(transfer.createdAt).toLocaleString()}
              />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Productos
              </h2>
              <div className="mt-4 grid gap-3">
                {transfer.items.map((item) => (
                  <article
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    key={item.id}
                  >
                    <p className="font-semibold text-slate-950">
                      {item.product.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      SKU {item.product.sku ?? 'N/D'} / Cantidad{' '}
                      {Number(item.quantity)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Auditoria
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Usuario: {transfer.createdBy?.name ?? 'Usuario no disponible'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Nota: {transfer.note ?? 'Sin nota'}
              </p>
              <Button className="mt-4" type="button" variant="secondary">
                Accion no disponible en esta fase
              </Button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </article>
  );
}
