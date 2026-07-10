'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import {
  createBranch,
  getBranch,
  listBranches,
  setMainBranch,
  updateBranch,
  updateBranchStatus,
  type Branch,
  type CreateBranchPayload,
} from '@/lib/branches';

type BranchFormState = CreateBranchPayload & {
  status: Branch['status'];
};

const emptyForm: BranchFormState = {
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  province: '',
  isMain: false,
  status: 'ACTIVE',
};

export function BranchesList() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setBranches(await listBranches());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void listBranches()
      .then((items) => {
        if (!cancelled) setBranches(items);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : 'No se pudo cargar',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo actualizar',
      );
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              Configuracion
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Sucursales
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Administra las ubicaciones operativas de la empresa.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            href="/settings/branches/new"
          >
            Crear sucursal
          </Link>
        </header>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Codigo</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Provincia</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Principal</th>
                  <th className="px-4 py-3">Usuarios</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      Cargando sucursales...
                    </td>
                  </tr>
                ) : branches.length ? (
                  branches.map((branch) => (
                    <tr key={branch.id}>
                      <td className="px-4 py-3 font-semibold text-slate-950">
                        {branch.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {branch.code}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {branch.city ?? 'N/D'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {branch.province ?? 'N/D'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={branch.status} />
                      </td>
                      <td className="px-4 py-3">
                        {branch.isMain ? 'Si' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {branch._count?.userMemberships ??
                          branch._count?.users ??
                          0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                            href={`/settings/branches/${branch.id}`}
                          >
                            Editar
                          </Link>
                          {!branch.isMain && branch.status === 'ACTIVE' && (
                            <button
                              className="rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                              type="button"
                              onClick={() =>
                                void run(() => setMainBranch(branch.id))
                              }
                            >
                              Principal
                            </button>
                          )}
                          <button
                            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                            type="button"
                            onClick={() =>
                              void run(() =>
                                updateBranchStatus(
                                  branch.id,
                                  branch.status !== 'ACTIVE',
                                ),
                              )
                            }
                          >
                            {branch.status === 'ACTIVE'
                              ? 'Desactivar'
                              : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={8}>
                      No hay sucursales registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export function BranchFormPage({ branchId }: { branchId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<BranchFormState>(emptyForm);
  const [initialStatus, setInitialStatus] = useState<Branch['status'] | null>(
    null,
  );
  const [loading, setLoading] = useState(Boolean(branchId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    void getBranch(branchId)
      .then((branch) => {
        if (cancelled) return;
        setForm({
          name: branch.name,
          code: branch.code,
          phone: branch.phone ?? '',
          email: branch.email ?? '',
          address: branch.address ?? '',
          city: branch.city ?? '',
          province: branch.province ?? '',
          isMain: branch.isMain,
          status: branch.status,
        });
        setInitialStatus(branch.status);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la sucursal',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: CreateBranchPayload = {
        name: form.name.trim(),
        code: form.code.toUpperCase(),
        phone: clean(form.phone),
        email: clean(form.email),
        address: clean(form.address),
        city: clean(form.city),
        province: clean(form.province),
        isMain: form.isMain,
      };
      if (branchId) {
        await updateBranch(branchId, payload);
        if (initialStatus && form.status !== initialStatus) {
          await updateBranchStatus(branchId, form.status === 'ACTIVE');
        }
      } else {
        await createBranch(payload);
      }
      router.push('/settings/branches');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Sucursales
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {branchId ? 'Editar sucursal' : 'Nueva sucursal'}
          </h1>
        </header>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form
          className="mt-6 grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
          onSubmit={(event) => void submit(event)}
        >
          {loading ? (
            <p className="text-sm text-slate-500">Cargando sucursal...</p>
          ) : (
            <>
              <Field
                label="Nombre"
                required
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <Field
                label="Codigo"
                required
                value={form.code}
                onChange={(value) =>
                  setForm({ ...form, code: value.toUpperCase() })
                }
              />
              <Field
                label="Telefono"
                value={form.phone ?? ''}
                onChange={(value) => setForm({ ...form, phone: value })}
              />
              <Field
                label="Email"
                type="email"
                value={form.email ?? ''}
                onChange={(value) => setForm({ ...form, email: value })}
              />
              <Field
                label="Ciudad"
                value={form.city ?? ''}
                onChange={(value) => setForm({ ...form, city: value })}
              />
              <Field
                label="Provincia"
                value={form.province ?? ''}
                onChange={(value) => setForm({ ...form, province: value })}
              />
              <label className="md:col-span-2">
                Direccion
                <textarea
                  className="mt-1"
                  rows={3}
                  value={form.address ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  checked={Boolean(form.isMain)}
                  type="checkbox"
                  onChange={(event) =>
                    setForm({ ...form, isMain: event.target.checked })
                  }
                />
                Marcar como principal
              </label>
              {branchId && (
                <label>
                  Estado
                  <select
                    className="mt-1"
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as Branch['status'],
                      })
                    }
                  >
                    <option value="ACTIVE">Activa</option>
                    <option value="INACTIVE">Inactiva</option>
                  </select>
                </label>
              )}
              <div className="flex gap-3 md:col-span-2">
                <Button disabled={saving} type="submit">
                  {saving ? 'Guardando...' : 'Guardar sucursal'}
                </Button>
                <Link
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                  href="/settings/branches"
                >
                  Cancelar
                </Link>
              </div>
            </>
          )}
        </form>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: Branch['status'] }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === 'ACTIVE'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function Field({
  label,
  onChange,
  required = false,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        className="mt-1"
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}
