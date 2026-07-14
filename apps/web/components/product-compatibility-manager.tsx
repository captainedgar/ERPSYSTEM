'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { useAuth } from '@/components/auth-provider';
import { listCatalog, type Product } from '@/lib/catalog';
import { hasPermission } from '@/lib/permissions';
import {
  addAlternativeCode,
  addProductToCompatibilityGroup,
  addSubstitute,
  createCompatibilityGroup,
  getProductCompatibility,
  listCompatibilityGroups,
  productLabel,
  removeAlternativeCode,
  removeProductFromCompatibilityGroup,
  removeSubstitute,
  type ProductAlternativeCodeType,
  type ProductCompatibilityGroup,
  type ProductCompatibilityResponse,
  type ProductSubstituteType,
} from '@/lib/product-compatibility';

const codeTypes: ProductAlternativeCodeType[] = [
  'OEM',
  'MANUFACTURER',
  'REPLACEMENT',
  'OLD_CODE',
  'BARCODE',
  'OTHER',
];
const substituteTypes: ProductSubstituteType[] = [
  'EQUIVALENT',
  'SUBSTITUTE',
  'UPGRADE',
  'DOWNGRADE',
  'RELATED',
];

export function ProductCompatibilityManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductCompatibilityGroup[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [compatibility, setCompatibility] =
    useState<ProductCompatibilityResponse | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', code: '' });
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [codeForm, setCodeForm] = useState({
    code: '',
    type: 'OEM' as ProductAlternativeCodeType,
  });
  const [substituteForm, setSubstituteForm] = useState({
    substituteProductId: '',
    type: 'SUBSTITUTE' as ProductSubstituteType,
    isBidirectional: true,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedProduct = products.find(({ id }) => id === selectedProductId);
  const canManage = hasPermission(user, 'product_compatibility.manage');
  const substituteOptions = useMemo(
    () => products.filter(({ id }) => id !== selectedProductId),
    [products, selectedProductId],
  );

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void loadInitial();
  }, [user]);

  useEffect(() => {
    if (!selectedProductId) return;
    let cancelled = false;
    void getProductCompatibility(selectedProductId).then((response) => {
      if (!cancelled) setCompatibility(response);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [nextProducts, nextGroups] = await Promise.all([
        listCatalog<Product>('products'),
        listCompatibilityGroups(),
      ]);
      setProducts(nextProducts);
      setGroups(nextGroups);
      setSelectedProductId(nextProducts[0]?.id ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }

  async function refreshCompatibility(productId = selectedProductId) {
    if (!productId) return;
    setCompatibility(await getProductCompatibility(productId));
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const group = await createCompatibilityGroup(groupForm);
      setGroups((current) => [group, ...current]);
      setGroupForm({ name: '', code: '' });
      setMessage('Grupo creado.');
    });
  }

  async function assignGroup() {
    if (!selectedProductId || !selectedGroupId) return;
    await run(async () => {
      await addProductToCompatibilityGroup(selectedGroupId, selectedProductId);
      await refreshCompatibility();
      setMessage('Producto asignado al grupo.');
    });
  }

  async function removeGroup(groupId: string) {
    if (!selectedProductId) return;
    await run(async () => {
      await removeProductFromCompatibilityGroup(groupId, selectedProductId);
      await refreshCompatibility();
      setMessage('Producto removido del grupo.');
    });
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProductId) return;
    await run(async () => {
      await addAlternativeCode(selectedProductId, codeForm);
      await refreshCompatibility();
      setCodeForm({ code: '', type: 'OEM' });
      setMessage('Codigo alterno agregado.');
    });
  }

  async function submitSubstitute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProductId || !substituteForm.substituteProductId) return;
    await run(async () => {
      await addSubstitute(selectedProductId, substituteForm);
      await refreshCompatibility();
      setSubstituteForm({
        substituteProductId: '',
        type: 'SUBSTITUTE',
        isBidirectional: true,
      });
      setMessage('Sustituto agregado.');
    });
  }

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar');
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
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Catalogo / Compatibilidad
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Productos compatibles y sustitutos
            </h1>
            <p className="mt-2 text-slate-500">
              Registra grupos, codigos OEM y sustitutos sin inventar relaciones.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-blue-700"
            href="/catalog/products"
          >
            Volver a productos
          </Link>
        </header>

        {error && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </p>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label>
              Producto
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {productLabel(product)}
                  </option>
                ))}
              </select>
            </label>
            {selectedProduct && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">
                  {selectedProduct.name}
                </p>
                <p className="mt-1">Stock: {Number(selectedProduct.stock)}</p>
                <p>{selectedProduct.brand?.name ?? 'Sin marca'}</p>
              </div>
            )}
          </section>

          <section className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                onSubmit={(event) => void submitGroup(event)}
              >
                <h2 className="text-lg font-semibold">Crear grupo</h2>
                <div className="mt-4 grid gap-3">
                  <label>
                    Nombre
                    <input
                      required
                      value={groupForm.name}
                      onChange={(event) =>
                        setGroupForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Codigo
                    <input
                      required
                      value={groupForm.code}
                      onChange={(event) =>
                        setGroupForm((current) => ({
                          ...current,
                          code: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </label>
                  <Button disabled={submitting || !canManage} type="submit">
                    Crear grupo
                  </Button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Asignar a grupo</h2>
                <div className="mt-4 grid gap-3">
                  <select
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                  >
                    <option value="">Selecciona grupo</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.code} / {group.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={
                      submitting ||
                      !canManage ||
                      !selectedGroupId ||
                      !selectedProductId
                    }
                    onClick={() => void assignGroup()}
                    type="button"
                  >
                    Asignar producto
                  </Button>
                </div>
                <List title="Grupos del producto">
                  {compatibility?.groups.map(({ group }) => (
                    <Row
                      key={group.id}
                      title={group.code}
                      subtitle={group.name}
                      onRemove={
                        canManage ? () => void removeGroup(group.id) : undefined
                      }
                    />
                  ))}
                </List>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <form
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                onSubmit={(event) => void submitCode(event)}
              >
                <h2 className="text-lg font-semibold">Codigos alternos</h2>
                <div className="mt-4 grid gap-3">
                  <input
                    placeholder="BKR6E, OEM..."
                    required
                    value={codeForm.code}
                    onChange={(event) =>
                      setCodeForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                  />
                  <select
                    value={codeForm.type}
                    onChange={(event) =>
                      setCodeForm((current) => ({
                        ...current,
                        type: event.target.value as ProductAlternativeCodeType,
                      }))
                    }
                  >
                    {codeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={submitting || !canManage || !selectedProductId}
                    type="submit"
                  >
                    Agregar codigo
                  </Button>
                </div>
                <List title="Codigos registrados">
                  {compatibility?.alternativeCodes.map((code) => (
                    <Row
                      key={code.id}
                      title={code.code}
                      subtitle={code.type}
                      onRemove={
                        canManage
                          ? () =>
                              void run(async () => {
                                await removeAlternativeCode(
                                  selectedProductId,
                                  code.id,
                                );
                                await refreshCompatibility();
                              })
                          : undefined
                      }
                    />
                  ))}
                </List>
              </form>

              <form
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                onSubmit={(event) => void submitSubstitute(event)}
              >
                <h2 className="text-lg font-semibold">Sustitutos</h2>
                <div className="mt-4 grid gap-3">
                  <select
                    required
                    value={substituteForm.substituteProductId}
                    onChange={(event) =>
                      setSubstituteForm((current) => ({
                        ...current,
                        substituteProductId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Producto sustituto</option>
                    {substituteOptions.map((product) => (
                      <option key={product.id} value={product.id}>
                        {productLabel(product)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={substituteForm.type}
                    onChange={(event) =>
                      setSubstituteForm((current) => ({
                        ...current,
                        type: event.target.value as ProductSubstituteType,
                      }))
                    }
                  >
                    {substituteTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={substituteForm.isBidirectional}
                      type="checkbox"
                      onChange={() =>
                        setSubstituteForm((current) => ({
                          ...current,
                          isBidirectional: !current.isBidirectional,
                        }))
                      }
                    />
                    Bidireccional
                  </label>
                  <Button
                    disabled={submitting || !canManage || !selectedProductId}
                    type="submit"
                  >
                    Agregar sustituto
                  </Button>
                </div>
                <List title="Sustitutos registrados">
                  {compatibility?.substitutes.map((item) => (
                    <Row
                      key={item.id}
                      title={
                        item.productId === selectedProductId
                          ? item.substituteProduct.name
                          : item.product.name
                      }
                      subtitle={`${item.type} / ${
                        item.isBidirectional ? 'Bidireccional' : 'Direccional'
                      }`}
                      onRemove={
                        canManage
                          ? () =>
                              void run(async () => {
                                await removeSubstitute(
                                  selectedProductId,
                                  item.id,
                                );
                                await refreshCompatibility();
                              })
                          : undefined
                      }
                    />
                  ))}
                </List>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">
                Alternativas compatibles con stock
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Estas alternativas fueron registradas como compatibles en el
                catalogo.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {compatibility?.alternatives.length ? (
                  compatibility.alternatives.map((item) => (
                    <div
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      key={item.id}
                    >
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.sku ?? item.barcode ?? 'Sin codigo'} / Stock{' '}
                        {Number(item.stock)}
                      </p>
                      <p className="mt-2 text-xs text-blue-700">
                        {item.reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Sin alternativas con stock.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function List({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="mt-2 grid gap-2">
        {children || <p className="text-sm text-slate-500">Sin registros.</p>}
      </div>
    </div>
  );
}

function Row({
  onRemove,
  subtitle,
  title,
}: {
  onRemove?: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {onRemove && (
        <button
          className="text-xs font-semibold text-red-600"
          onClick={onRemove}
          type="button"
        >
          Quitar
        </button>
      )}
    </div>
  );
}
