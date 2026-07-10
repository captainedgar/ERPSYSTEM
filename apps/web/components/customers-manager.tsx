'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  createCustomer,
  CustomerDocumentType,
  CustomerStatus,
  CustomerType,
  listCustomers,
  TaxpayerType,
  updateCustomer,
  updateCustomerStatus,
  type Customer,
} from '@/lib/customers';

interface FormState {
  id?: string;
  type: CustomerType;
  name: string;
  commercialName: string;
  documentType: CustomerDocumentType;
  documentNumber: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  city: string;
  province: string;
  country: string;
  taxpayerType: TaxpayerType;
  paymentTermsDays: string;
  creditLimit: string;
  notes: string;
  status: CustomerStatus;
}

const emptyForm: FormState = {
  type: CustomerType.INDIVIDUAL,
  name: '',
  commercialName: '',
  documentType: CustomerDocumentType.NONE,
  documentNumber: '',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  city: '',
  province: '',
  country: 'República Dominicana',
  taxpayerType: TaxpayerType.FINAL_CONSUMER,
  paymentTermsDays: '0',
  creditLimit: '0',
  notes: '',
  status: CustomerStatus.ACTIVE,
};

const typeLabels: Record<CustomerType, string> = {
  [CustomerType.INDIVIDUAL]: 'Persona',
  [CustomerType.BUSINESS]: 'Empresa',
};

const documentLabels: Record<CustomerDocumentType, string> = {
  [CustomerDocumentType.CEDULA]: 'Cédula',
  [CustomerDocumentType.RNC]: 'RNC',
  [CustomerDocumentType.PASSPORT]: 'Pasaporte',
  [CustomerDocumentType.NONE]: 'Sin documento',
};

const taxpayerLabels: Record<TaxpayerType, string> = {
  [TaxpayerType.FINAL_CONSUMER]: 'Consumidor final',
  [TaxpayerType.FISCAL_CONSUMER]: 'Consumidor fiscal',
  [TaxpayerType.GOVERNMENT]: 'Gubernamental',
  [TaxpayerType.SPECIAL_REGIME]: 'Régimen especial',
  [TaxpayerType.NONE]: 'Sin clasificación',
};

export function CustomersManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const limit = 20;

  const role = user?.role.code;
  const canCreate = ['OWNER', 'ADMIN', 'CASHIER', 'SELLER'].includes(
    role ?? '',
  );
  const canUpdate = ['OWNER', 'ADMIN', 'ACCOUNTING'].includes(role ?? '');
  const canChangeStatus = ['OWNER', 'ADMIN'].includes(role ?? '');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void loadCustomers(1);
    // Authentication is the only initial data dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadCustomers(nextPage = page) {
    setLoading(true);
    setError('');
    try {
      const response = await listCustomers({
        search: search.trim() || undefined,
        type: typeFilter ? (typeFilter as CustomerType) : undefined,
        status: statusFilter ? (statusFilter as CustomerStatus) : undefined,
        page: nextPage,
        limit,
      });
      setItems(response.items);
      setTotal(response.total);
      setPage(response.page);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar los clientes',
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
      const payload = customerPayload(form, !form.id);
      if (form.id) {
        await updateCustomer(form.id, payload);
        setMessage('Cliente actualizado.');
      } else {
        await createCustomer(payload);
        setMessage('Cliente creado.');
      }
      setForm(emptyForm);
      await loadCustomers(form.id ? page : 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  }

  function edit(customer: Customer) {
    setForm({
      id: customer.id,
      type: customer.type,
      name: customer.name,
      commercialName: customer.commercialName ?? '',
      documentType: customer.documentType,
      documentNumber: customer.documentNumber ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      mobile: customer.mobile ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      province: customer.province ?? '',
      country: customer.country ?? '',
      taxpayerType: customer.taxpayerType,
      paymentTermsDays: String(customer.paymentTermsDays),
      creditLimit: String(customer.creditLimit),
      notes: customer.notes ?? '',
      status: customer.status,
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleStatus(customer: Customer) {
    setChangingStatusId(customer.id);
    setError('');
    setMessage('');
    try {
      await updateCustomerStatus(
        customer.id,
        customer.status === CustomerStatus.ACTIVE
          ? CustomerStatus.INACTIVE
          : CustomerStatus.ACTIVE,
      );
      setMessage('Estado del cliente actualizado.');
      await loadCustomers(page);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cambiar el estado',
      );
    } finally {
      setChangingStatusId(null);
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
        Redirigiendo al acceso del sistema…
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Clientes · Comercia ERP
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Clientes</h1>
            <p className="mt-2 text-slate-500">
              Administra contactos, identificación y condiciones comerciales.
            </p>
          </div>
          <Link
            className="text-sm text-slate-600 hover:text-slate-950"
            href="/dashboard"
          >
            Volver al panel
          </Link>
        </header>

        <div
          className={`mt-6 grid gap-6 ${
            canCreate || canUpdate ? 'lg:grid-cols-[420px_1fr]' : ''
          }`}
        >
          {(canCreate || (canUpdate && form.id)) && (
            <CustomerForm
              canCreate={canCreate}
              change={change}
              form={form}
              onCancel={() => setForm(emptyForm)}
              onSubmit={submit}
              submitting={submitting}
            />
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <form
              className="grid gap-3 md:grid-cols-[1fr_170px_170px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void loadCustomers(1);
              }}
            >
              <input
                aria-label="Buscar clientes"
                placeholder="Nombre, documento, teléfono o email…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filtrar por tipo"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">Todos los tipos</option>
                {Object.values(CustomerType).map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value={CustomerStatus.ACTIVE}>Activos</option>
                <option value={CustomerStatus.INACTIVE}>Inactivos</option>
              </select>
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>

            {error && (
              <div
                className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
                role="alert"
              >
                <p>{error}</p>
                <Button
                  className="mt-3"
                  onClick={() => void loadCustomers(page)}
                  type="button"
                  variant="secondary"
                >
                  Reintentar
                </Button>
              </div>
            )}
            {message && (
              <p className="mt-4 text-sm text-blue-600" role="status">
                {message}
              </p>
            )}

            <div className="mt-5 grid gap-3">
              {loading ? (
                <p className="py-8 text-center text-slate-500">
                  Cargando clientes…
                </p>
              ) : !items.length ? (
                <p className="py-8 text-center text-slate-500">
                  No hay clientes para estos filtros.
                </p>
              ) : (
                items.map((customer) => (
                  <CustomerCard
                    canChangeStatus={canChangeStatus}
                    canUpdate={canUpdate}
                    changingStatus={changingStatusId === customer.id}
                    customer={customer}
                    key={customer.id}
                    onEdit={edit}
                    onToggleStatus={(item) => void toggleStatus(item)}
                  />
                ))
              )}
            </div>

            {!loading && total > 0 && (
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-500">
                <span>
                  Página {page} de {Math.max(1, Math.ceil(total / limit))} ·{' '}
                  {total} clientes
                </span>
                <div className="flex gap-2">
                  <Button
                    disabled={page <= 1}
                    onClick={() => void loadCustomers(page - 1)}
                    type="button"
                    variant="secondary"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={page * limit >= total}
                    onClick={() => void loadCustomers(page + 1)}
                    type="button"
                    variant="secondary"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function CustomerForm({
  canCreate,
  change,
  form,
  onCancel,
  onSubmit,
  submitting,
}: {
  canCreate: boolean;
  change: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  form: FormState;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitting: boolean;
}) {
  return (
    <form
      className="h-fit rounded-3xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => void onSubmit(event)}
    >
      <h2 className="text-xl font-semibold">
        {form.id ? 'Editar cliente' : 'Crear cliente'}
      </h2>
      <div className="mt-5 grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label>
            Tipo
            <select
              value={form.type}
              onChange={(event) =>
                change('type', event.target.value as CustomerType)
              }
            >
              {Object.values(CustomerType).map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              disabled={Boolean(form.id)}
              value={form.status}
              onChange={(event) =>
                change('status', event.target.value as CustomerStatus)
              }
            >
              <option value={CustomerStatus.ACTIVE}>Activo</option>
              <option value={CustomerStatus.INACTIVE}>Inactivo</option>
            </select>
          </label>
        </div>
        <label>
          Nombre
          <input
            maxLength={160}
            minLength={1}
            required
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
          />
        </label>
        <label>
          Nombre comercial
          <input
            maxLength={160}
            value={form.commercialName}
            onChange={(event) => change('commercialName', event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Documento
            <select
              value={form.documentType}
              onChange={(event) =>
                change(
                  'documentType',
                  event.target.value as CustomerDocumentType,
                )
              }
            >
              {Object.values(CustomerDocumentType).map((type) => (
                <option key={type} value={type}>
                  {documentLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Número
            <input
              disabled={form.documentType === CustomerDocumentType.NONE}
              maxLength={40}
              value={form.documentNumber}
              onChange={(event) => change('documentNumber', event.target.value)}
            />
          </label>
        </div>
        <label>
          Tipo fiscal
          <select
            value={form.taxpayerType}
            onChange={(event) =>
              change('taxpayerType', event.target.value as TaxpayerType)
            }
          >
            {Object.values(TaxpayerType).map((type) => (
              <option key={type} value={type}>
                {taxpayerLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Email
            <input
              maxLength={254}
              type="email"
              value={form.email}
              onChange={(event) => change('email', event.target.value)}
            />
          </label>
          <label>
            Teléfono
            <input
              maxLength={30}
              type="tel"
              value={form.phone}
              onChange={(event) => change('phone', event.target.value)}
            />
          </label>
        </div>
        <label>
          Celular
          <input
            maxLength={30}
            type="tel"
            value={form.mobile}
            onChange={(event) => change('mobile', event.target.value)}
          />
        </label>
        <label>
          Dirección
          <input
            maxLength={500}
            value={form.address}
            onChange={(event) => change('address', event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Ciudad
            <input
              maxLength={100}
              value={form.city}
              onChange={(event) => change('city', event.target.value)}
            />
          </label>
          <label>
            Provincia
            <input
              maxLength={100}
              value={form.province}
              onChange={(event) => change('province', event.target.value)}
            />
          </label>
        </div>
        <label>
          País
          <input
            maxLength={100}
            value={form.country}
            onChange={(event) => change('country', event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Días de crédito
            <input
              max="3650"
              min="0"
              required
              step="1"
              type="number"
              value={form.paymentTermsDays}
              onChange={(event) =>
                change('paymentTermsDays', event.target.value)
              }
            />
          </label>
          <label>
            Límite de crédito
            <input
              min="0"
              required
              step="0.01"
              type="number"
              value={form.creditLimit}
              onChange={(event) => change('creditLimit', event.target.value)}
            />
          </label>
        </div>
        <label>
          Notas
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-950"
            maxLength={2000}
            value={form.notes}
            onChange={(event) => change('notes', event.target.value)}
          />
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button disabled={submitting || (!form.id && !canCreate)} type="submit">
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
        {form.id && (
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function CustomerCard({
  canChangeStatus,
  canUpdate,
  changingStatus,
  customer,
  onEdit,
  onToggleStatus,
}: {
  canChangeStatus: boolean;
  canUpdate: boolean;
  changingStatus: boolean;
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onToggleStatus: (customer: Customer) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{customer.name}</h3>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {typeLabels[customer.type]}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs ${
                customer.status === CustomerStatus.ACTIVE
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-slate-200 bg-slate-100 text-slate-700'
              }`}
            >
              {customer.status === CustomerStatus.ACTIVE
                ? 'Activo'
                : 'Inactivo'}
            </span>
          </div>
          {customer.commercialName && (
            <p className="mt-1 text-sm text-slate-600">
              {customer.commercialName}
            </p>
          )}
          <p className="mt-2 text-sm text-slate-500">
            {customer.documentNumber
              ? `${documentLabels[customer.documentType]}: ${customer.documentNumber}`
              : 'Sin documento'}
            {' · '}
            {customer.phone || customer.mobile || 'Sin teléfono'}
            {' · '}
            {customer.email || 'Sin email'}
          </p>
        </div>
        <div className="flex gap-2">
          {canUpdate && (
            <Button
              onClick={() => onEdit(customer)}
              type="button"
              variant="secondary"
            >
              Editar
            </Button>
          )}
          {canChangeStatus && (
            <Button
              disabled={changingStatus}
              onClick={() => onToggleStatus(customer)}
              type="button"
              variant="secondary"
            >
              {changingStatus
                ? 'Actualizando…'
                : customer.status === CustomerStatus.ACTIVE
                  ? 'Desactivar'
                  : 'Activar'}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function customerPayload(form: FormState, includeStatus: boolean) {
  const nullable = (value: string) => value.trim() || null;
  return {
    type: form.type,
    name: form.name.trim(),
    commercialName: nullable(form.commercialName),
    documentType: form.documentType,
    documentNumber:
      form.documentType === CustomerDocumentType.NONE
        ? null
        : nullable(form.documentNumber),
    email: nullable(form.email),
    phone: nullable(form.phone),
    mobile: nullable(form.mobile),
    address: nullable(form.address),
    city: nullable(form.city),
    province: nullable(form.province),
    country: nullable(form.country),
    taxpayerType: form.taxpayerType,
    paymentTermsDays: Number(form.paymentTermsDays),
    creditLimit: Number(form.creditLimit),
    notes: nullable(form.notes),
    ...(includeStatus ? { status: form.status } : {}),
  };
}
