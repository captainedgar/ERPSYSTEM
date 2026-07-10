'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  CatalogStatus,
  CategoryType,
  createCatalog,
  listCatalog,
  updateCatalog,
  updateCatalogStatus,
  type Brand,
  type CatalogEntity,
  type CatalogKind,
  type Category,
  type Product,
  type Service,
  type Unit,
} from '@/lib/catalog';

interface FormState {
  id?: string;
  name: string;
  description: string;
  type: CategoryType;
  code: string;
  allowsDecimals: boolean;
  categoryId: string;
  brandId: string;
  unitId: string;
  sku: string;
  barcode: string;
  cost: string;
  price: string;
  taxRate: string;
  stock: string;
  minStock: string;
  trackInventory: boolean;
  allowDiscount: boolean;
  durationMinutes: string;
  imageUrl: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  type: CategoryType.PRODUCT,
  code: '',
  allowsDecimals: false,
  categoryId: '',
  brandId: '',
  unitId: '',
  sku: '',
  barcode: '',
  cost: '0',
  price: '0',
  taxRate: '18',
  stock: '0',
  minStock: '0',
  trackInventory: true,
  allowDiscount: true,
  durationMinutes: '',
  imageUrl: '',
};

const titles: Record<CatalogKind, string> = {
  categories: 'Categorías',
  brands: 'Marcas',
  units: 'Unidades de medida',
  products: 'Productos',
  services: 'Servicios',
};

const navItems: Array<[CatalogKind, string]> = [
  ['products', 'Productos'],
  ['services', 'Servicios'],
  ['categories', 'Categorías'],
  ['brands', 'Marcas'],
  ['units', 'Unidades'],
];

export function CatalogManager({ kind }: { kind: CatalogKind }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<CatalogEntity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void loadAll();
    // The selected catalog kind defines the complete data dependency set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, user]);

  const availableCategories = useMemo(
    () =>
      categories.filter(
        ({ type, status }) =>
          status === CatalogStatus.ACTIVE &&
          (type === CategoryType.BOTH ||
            (kind === 'products' && type === CategoryType.PRODUCT) ||
            (kind === 'services' && type === CategoryType.SERVICE)),
      ),
    [categories, kind],
  );

  async function loadAll(currentSearch = '') {
    setLoading(true);
    setError('');
    try {
      const dependencies: [
        Promise<CatalogEntity[]>,
        Promise<Category[]>,
        Promise<Brand[]>,
        Promise<Unit[]>,
      ] = [
        listCatalog<CatalogEntity>(kind, currentSearch),
        kind === 'products' || kind === 'services'
          ? listCatalog<Category>('categories')
          : Promise.resolve([]),
        kind === 'products'
          ? listCatalog<Brand>('brands')
          : Promise.resolve([]),
        kind === 'products' ? listCatalog<Unit>('units') : Promise.resolve([]),
      ];
      const [nextItems, nextCategories, nextBrands, nextUnits] =
        await Promise.all(dependencies);
      setItems(nextItems);
      setCategories(nextCategories);
      setBrands(nextBrands);
      setUnits(nextUnits);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo cargar catálogo',
      );
    } finally {
      setLoading(false);
    }
  }

  function change<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = payloadFor(kind, form);
      if (form.id) {
        await updateCatalog(kind, form.id, payload);
        setMessage(`${singular(kind)} actualizado.`);
      } else {
        await createCatalog(kind, payload);
        setMessage(`${singular(kind)} creado.`);
      }
      setForm(emptyForm);
      await loadAll(search);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  function edit(item: CatalogEntity) {
    const product = item as Partial<Product>;
    const service = item as Partial<Service>;
    const category = item as Partial<Category>;
    const unit = item as Partial<Unit>;
    setForm({
      ...emptyForm,
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      type: category.type ?? CategoryType.PRODUCT,
      code: unit.code ?? '',
      allowsDecimals: unit.allowsDecimals ?? false,
      categoryId: product.categoryId ?? service.categoryId ?? '',
      brandId: product.brandId ?? '',
      unitId: product.unitId ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      cost: String(product.cost ?? 0),
      price: String(product.price ?? service.price ?? 0),
      taxRate: String(product.taxRate ?? service.taxRate ?? 18),
      stock: String(product.stock ?? 0),
      minStock: String(product.minStock ?? 0),
      trackInventory: product.trackInventory ?? true,
      allowDiscount: product.allowDiscount ?? service.allowDiscount ?? true,
      durationMinutes: String(service.durationMinutes ?? ''),
      imageUrl: product.imageUrl ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleStatus(item: CatalogEntity) {
    setError('');
    try {
      await updateCatalogStatus(
        kind,
        item.id,
        item.status === CatalogStatus.ACTIVE
          ? CatalogStatus.INACTIVE
          : CatalogStatus.ACTIVE,
      );
      await loadAll(search);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo cambiar estado',
      );
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

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Catálogo · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{titles[kind]}</h1>
            <p className="mt-2 text-slate-500">
              Administra el catálogo de tu empresa sin afectar inventario.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {kind === 'products' && (
              <Link
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                href="/catalog/products/import"
              >
                Importar Excel
              </Link>
            )}
            <Link
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
              href="/dashboard"
            >
              Volver al panel
            </Link>
          </div>
        </header>

        <nav className="mt-6 flex flex-wrap gap-2">
          {navItems.map(([path, label]) => (
            <Link
              className={`rounded-xl px-4 py-2 text-sm ${
                path === kind
                  ? 'bg-emerald-500 font-semibold text-white'
                  : 'bg-slate-50 text-slate-600'
              }`}
              href={`/catalog/${path}`}
              key={path}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            className="h-fit rounded-3xl border border-slate-200 bg-white p-6"
            onSubmit={(event) => void submit(event)}
          >
            <h2 className="text-xl font-semibold">
              {form.id ? 'Editar' : 'Crear'} {singular(kind).toLowerCase()}
            </h2>
            <div className="mt-5 grid gap-4">
              <label>
                Nombre
                <input
                  maxLength={160}
                  minLength={2}
                  required
                  value={form.name}
                  onChange={(event) => change('name', event.target.value)}
                />
              </label>
              {kind === 'categories' && (
                <label>
                  Tipo
                  <select
                    value={form.type}
                    onChange={(event) =>
                      change('type', event.target.value as CategoryType)
                    }
                  >
                    <option value={CategoryType.PRODUCT}>Producto</option>
                    <option value={CategoryType.SERVICE}>Servicio</option>
                    <option value={CategoryType.BOTH}>Ambos</option>
                  </select>
                </label>
              )}
              {kind === 'units' && (
                <>
                  <label>
                    Código
                    <input
                      maxLength={12}
                      required
                      value={form.code}
                      onChange={(event) =>
                        change('code', event.target.value.toUpperCase())
                      }
                    />
                  </label>
                  <Check
                    checked={form.allowsDecimals}
                    label="Permite decimales"
                    onChange={() =>
                      change('allowsDecimals', !form.allowsDecimals)
                    }
                  />
                </>
              )}
              {(kind === 'products' || kind === 'services') && (
                <label>
                  Categoría
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      change('categoryId', event.target.value)
                    }
                  >
                    <option value="">Sin categoría</option>
                    {availableCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {kind === 'products' && (
                <ProductFields
                  brands={brands}
                  change={change}
                  form={form}
                  units={units}
                />
              )}
              {kind === 'services' && (
                <ServiceFields change={change} form={form} />
              )}
              {kind !== 'units' && (
                <label>
                  Descripción
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-950"
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) =>
                      change('description', event.target.value)
                    }
                  />
                </label>
              )}
            </div>
            {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
            {message && <p className="mt-4 text-sm text-blue-600">{message}</p>}
            <div className="mt-5 flex gap-2">
              <Button disabled={submitting} type="submit">
                {submitting ? 'Guardando…' : 'Guardar'}
              </Button>
              {form.id && (
                <Button
                  onClick={() => setForm(emptyForm)}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadAll(search);
              }}
            >
              <input
                placeholder="Buscar por nombre, SKU o código…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
            <div className="mt-5 grid gap-3">
              {error && !items.length && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  <p>{error}</p>
                  <Button
                    className="mt-3"
                    onClick={() => void loadAll(search)}
                    type="button"
                    variant="secondary"
                  >
                    Reintentar
                  </Button>
                </div>
              )}
              {!items.length && (
                <p className="py-8 text-center text-slate-500">
                  Aún no hay registros.
                </p>
              )}
              {items.map((item) => (
                <article
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={item.id}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          item.status === CatalogStatus.ACTIVE
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-slate-200 bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status === CatalogStatus.ACTIVE
                          ? 'Activo'
                          : 'Inactivo'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {summary(kind, item)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => edit(item)}
                      type="button"
                      variant="secondary"
                    >
                      Editar
                    </Button>
                    <Button
                      onClick={() => void toggleStatus(item)}
                      type="button"
                      variant="secondary"
                    >
                      {item.status === CatalogStatus.ACTIVE
                        ? 'Desactivar'
                        : 'Activar'}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function ProductFields({
  brands,
  change,
  form,
  units,
}: {
  brands: Brand[];
  change: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  form: FormState;
  units: Unit[];
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label>
          SKU
          <input
            value={form.sku}
            onChange={(event) => change('sku', event.target.value)}
          />
        </label>
        <label>
          Código de barra
          <input
            value={form.barcode}
            onChange={(event) => change('barcode', event.target.value)}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          Marca
          <select
            value={form.brandId}
            onChange={(event) => change('brandId', event.target.value)}
          >
            <option value="">Sin marca</option>
            {brands
              .filter(({ status }) => status === CatalogStatus.ACTIVE)
              .map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Unidad
          <select
            value={form.unitId}
            onChange={(event) => change('unitId', event.target.value)}
          >
            <option value="">Sin unidad</option>
            {units
              .filter(({ status }) => status === CatalogStatus.ACTIVE)
              .map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <NumberFields change={change} form={form} product />
      <Check
        checked={form.trackInventory}
        label="Controlar inventario"
        onChange={() => change('trackInventory', !form.trackInventory)}
      />
      <Check
        checked={form.allowDiscount}
        label="Permitir descuento"
        onChange={() => change('allowDiscount', !form.allowDiscount)}
      />
      <label>
        URL de imagen
        <input
          type="url"
          value={form.imageUrl}
          onChange={(event) => change('imageUrl', event.target.value)}
        />
      </label>
    </>
  );
}

function ServiceFields({
  change,
  form,
}: {
  change: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  form: FormState;
}) {
  return (
    <>
      <NumberFields change={change} form={form} />
      <label>
        Duración (minutos)
        <input
          min="1"
          type="number"
          value={form.durationMinutes}
          onChange={(event) => change('durationMinutes', event.target.value)}
        />
      </label>
      <Check
        checked={form.allowDiscount}
        label="Permitir descuento"
        onChange={() => change('allowDiscount', !form.allowDiscount)}
      />
    </>
  );
}

function NumberFields({
  change,
  form,
  product = false,
}: {
  change: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  form: FormState;
  product?: boolean;
}) {
  const fields: Array<[keyof FormState, string, string]> = product
    ? [
        ['cost', 'Costo', '0.01'],
        ['price', 'Precio', '0.01'],
        ['taxRate', 'ITBIS %', '0.01'],
        ['stock', 'Stock inicial', '0.001'],
        ['minStock', 'Stock mínimo', '0.001'],
      ]
    : [
        ['price', 'Precio', '0.01'],
        ['taxRate', 'ITBIS %', '0.01'],
      ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map(([field, label, step]) => (
        <label key={field}>
          {label}
          <input
            min="0"
            required={field === 'price'}
            step={step}
            type="number"
            value={String(form[field])}
            onChange={(event) => change(field, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function Check({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer grid-cols-none items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input checked={checked} onChange={onChange} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function payloadFor(kind: CatalogKind, form: FormState) {
  const optional = (value: string) => value.trim() || undefined;
  const base = {
    name: form.name.trim(),
    description: optional(form.description),
  };
  if (kind === 'categories') return { ...base, type: form.type };
  if (kind === 'brands') return base;
  if (kind === 'units') {
    return {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      allowsDecimals: form.allowsDecimals,
    };
  }
  if (kind === 'services') {
    return {
      ...base,
      categoryId: optional(form.categoryId),
      price: Number(form.price),
      taxRate: Number(form.taxRate),
      durationMinutes: form.durationMinutes
        ? Number(form.durationMinutes)
        : undefined,
      allowDiscount: form.allowDiscount,
    };
  }
  return {
    ...base,
    categoryId: optional(form.categoryId),
    brandId: optional(form.brandId),
    unitId: optional(form.unitId),
    sku: optional(form.sku),
    barcode: optional(form.barcode),
    cost: Number(form.cost),
    price: Number(form.price),
    taxRate: Number(form.taxRate),
    stock: Number(form.stock),
    minStock: Number(form.minStock),
    trackInventory: form.trackInventory,
    allowDiscount: form.allowDiscount,
    imageUrl: optional(form.imageUrl),
  };
}

function summary(kind: CatalogKind, item: CatalogEntity) {
  if (kind === 'categories') {
    return `Tipo: ${(item as Category).type}`;
  }
  if (kind === 'units') {
    const unit = item as Unit;
    return `${unit.code} · ${unit.allowsDecimals ? 'Permite decimales' : 'Enteros'}`;
  }
  if (kind === 'products') {
    const product = item as Product;
    return `RD$ ${Number(product.price).toFixed(2)} · ${product.category?.name ?? 'Sin categoría'} · Stock ${Number(product.stock)}`;
  }
  if (kind === 'services') {
    const service = item as Service;
    return `RD$ ${Number(service.price).toFixed(2)} · ${service.category?.name ?? 'Sin categoría'}`;
  }
  return item.description || 'Sin descripción';
}

function singular(kind: CatalogKind) {
  return {
    categories: 'Categoría',
    brands: 'Marca',
    units: 'Unidad',
    products: 'Producto',
    services: 'Servicio',
  }[kind];
}
