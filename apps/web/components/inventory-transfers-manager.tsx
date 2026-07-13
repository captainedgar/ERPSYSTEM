'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { listAvailableBranches, type AvailableBranch } from '@/lib/branches';
import { listCatalog, type Product } from '@/lib/catalog';
import {
  createInventoryTransfer,
  listInventoryTransfers,
  type InventoryTransfer,
} from '@/lib/inventory';

export function InventoryTransfersManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [branches, setBranches] = useState<AvailableBranch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const [branchResponse, productResponse, transferResponse] =
          await Promise.all([
            listAvailableBranches(),
            listCatalog<Product>('products'),
            listInventoryTransfers(),
          ]);
        if (cancelled) return;
        setBranches(branchResponse.items);
        setProducts(
          productResponse.filter((product) => product.trackInventory),
        );
        setTransfers(transferResponse);
        setFromBranchId(branchResponse.activeBranchId ?? '');
        setToBranchId(
          branchResponse.items.find(
            (branch) => branch.id !== branchResponse.activeBranchId,
          )?.id ?? '',
        );
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudieron cargar las transferencias.',
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
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const transfer = await createInventoryTransfer({
        fromBranchId,
        toBranchId,
        productId,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });
      setTransfers((current) => [transfer, ...current]);
      setQuantity('1');
      setNote('');
      setMessage('Transferencia registrada.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo registrar la transferencia.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
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
              Transferir inventario
            </h1>
            <p className="mt-2 text-slate-500">
              Mueve stock entre sucursales con salida y entrada auditadas.
            </p>
          </div>
          <Link className="text-sm text-blue-600" href="/inventory">
            Volver al inventario
          </Link>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            className="h-fit rounded-2xl border border-slate-200 bg-white p-5"
            onSubmit={(event) => void submit(event)}
          >
            <h2 className="text-lg font-semibold">Nueva transferencia</h2>
            <div className="mt-4 grid gap-4">
              <label>
                Sucursal origen
                <select
                  required
                  value={fromBranchId}
                  onChange={(event) => setFromBranchId(event.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sucursal destino
                <select
                  required
                  value={toBranchId}
                  onChange={(event) => setToBranchId(event.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Producto
                <select
                  required
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.sku ? ` · ${product.sku}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad
                <input
                  min="0.001"
                  required
                  step="0.001"
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <label>
                Nota
                <textarea
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
            {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
            {message && <p className="mt-4 text-sm text-blue-600">{message}</p>}
            <Button className="mt-5 w-full" disabled={submitting} type="submit">
              {submitting ? 'Registrando...' : 'Transferir'}
            </Button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Transferencias recientes</h2>
            <div className="mt-4 grid gap-3">
              {!transfers.length && (
                <p className="py-8 text-center text-slate-500">
                  No hay transferencias registradas.
                </p>
              )}
              {transfers.map((transfer) => {
                const item = transfer.items[0];
                return (
                  <article
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    key={transfer.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">
                          {item?.product.name ?? 'Producto'} ·{' '}
                          {Number(item?.quantity ?? 0)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {transfer.fromBranch.name} → {transfer.toBranch.name}
                        </p>
                        {transfer.note && (
                          <p className="mt-1 text-xs text-slate-500">
                            {transfer.note}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {new Date(transfer.createdAt).toLocaleString()}
                      </span>
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
