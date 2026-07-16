'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/components/auth-provider';
import { listBranches, type Branch } from '@/lib/branches';
import { hasPermission } from '@/lib/permissions';
import {
  createCompanyUser,
  getCompanyUser,
  listCompanyRoles,
  listCompanyUsers,
  updateCompanyUser,
  updateCompanyUserStatus,
  type CompanyRole,
  type CompanyUser,
} from '@/lib/users';

interface UserFormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  roleId: string;
  branchId: string;
}

const emptyForm: UserFormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
  roleId: '',
  branchId: '',
};

export function UsersManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [items, setItems] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'users.view');
  const canCreate = hasPermission(user, 'users.create');
  const canAssignRoles = hasPermission(user, 'roles.assign');
  const canUpdate = hasPermission(user, 'users.update');
  const canDisable = hasPermission(user, 'users.disable');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    void listCompanyUsers()
      .then((response) => {
        if (!cancelled) setItems(response);
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
  }, [canView, user]);

  async function toggleStatus(item: CompanyUser) {
    setError('');
    try {
      const updated = await updateCompanyUserStatus(
        item.id,
        item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      );
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? updated : candidate,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No tienes permiso para realizar esta accion.',
      );
    }
  }

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canView) {
    return <AccessDenied title="Usuarios" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
              Configuracion
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Usuarios
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Administra accesos internos sin exponer contrasenas ni tokens.
            </p>
          </div>
          {canCreate && canAssignRoles && (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              href="/settings/users/new"
            >
              Nuevo usuario
            </Link>
          )}
        </header>

        {error && <ErrorMessage message={error} />}

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Sucursal default</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Ultimo acceso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.role.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.branch?.name ?? 'Sin sucursal'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.lastLoginAt
                        ? new Date(item.lastLoginAt).toLocaleString()
                        : 'Nunca'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canUpdate &&
                          (user?.role.code === 'OWNER' ||
                            item.role.code !== 'OWNER') && (
                            <Link
                              className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                              href={`/settings/users/${item.id}`}
                            >
                              Editar
                            </Link>
                          )}
                        {canDisable &&
                          user?.id !== item.id &&
                          (user?.role.code === 'OWNER' ||
                            item.role.code !== 'OWNER') && (
                            <button
                              className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                              type="button"
                              onClick={() => void toggleStatus(item)}
                            >
                              {item.status === 'ACTIVE'
                                ? 'Desactivar'
                                : 'Activar'}
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-slate-500"
                      colSpan={7}
                    >
                      No hay datos disponibles.
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

export function UserFormPage({ userId }: { userId?: string }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [targetUser, setTargetUser] = useState<CompanyUser | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canCreate = hasPermission(user, 'users.create');
  const canUpdate = hasPermission(user, 'users.update');
  const canAssignRoles = hasPermission(user, 'roles.assign');
  const canAssignBranches = hasPermission(user, 'branches.assign_users');
  const canUse = userId ? canUpdate : canCreate && canAssignRoles;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canUse) return;
    let cancelled = false;
    async function load() {
      try {
        const [nextRoles, nextBranches, existing] = await Promise.all([
          listCompanyRoles(),
          listBranches(),
          userId ? getCompanyUser(userId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRoles(nextRoles.filter((role) => role.code !== 'OWNER'));
        setBranches(nextBranches);
        if (existing) {
          setTargetUser(existing);
          setForm({
            name: existing.name,
            email: existing.email,
            password: '',
            phone: existing.phone ?? '',
            roleId: existing.role.id,
            branchId: existing.branchId ?? '',
          });
        } else {
          setForm((current) => ({
            ...current,
            roleId: nextRoles.find((role) => role.code !== 'OWNER')?.id ?? '',
            branchId: nextBranches[0]?.id ?? '',
          }));
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo cargar la informacion.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canUse, user, userId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (userId) {
        await updateCompanyUser(userId, {
          name: form.name.trim(),
          phone: clean(form.phone),
          roleId:
            canAssignRoles && targetUser?.role.code !== 'OWNER'
              ? form.roleId
              : undefined,
          branchId: canAssignBranches ? clean(form.branchId) : undefined,
        });
      } else {
        await createCompanyUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: clean(form.phone),
          roleId: form.roleId,
          branchId: clean(form.branchId),
        });
      }
      router.push('/settings/users');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No tienes permiso para realizar esta accion.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (canUse && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canUse) {
    return <AccessDenied title={userId ? 'Editar usuario' : 'Crear usuario'} />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Usuarios
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {userId ? 'Editar usuario' : 'Nuevo usuario'}
          </h1>
          {targetUser && (
            <p className="mt-2 text-sm text-slate-600">
              {targetUser.email} / {targetUser.role.name}
            </p>
          )}
        </header>

        {error && <ErrorMessage message={error} />}

        <form
          className="mt-6 grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
          onSubmit={(event) => void submit(event)}
        >
          <Field
            label="Nombre"
            required
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            disabled={Boolean(userId)}
            label="Email"
            required
            type="email"
            value={form.email}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          {!userId && (
            <Field
              label="Contrasena temporal"
              minLength={8}
              required
              type="password"
              value={form.password}
              onChange={(value) => setForm({ ...form, password: value })}
            />
          )}
          <Field
            label="Telefono"
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          {canAssignRoles && targetUser?.role.code !== 'OWNER' && (
            <label>
              Rol
              <select
                className="mt-1"
                required
                value={form.roleId}
                onChange={(event) =>
                  setForm({ ...form, roleId: event.target.value })
                }
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} / {role.code}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canAssignBranches && (
            <label>
              Sucursal por defecto
              <select
                className="mt-1"
                value={form.branchId}
                onChange={(event) =>
                  setForm({ ...form, branchId: event.target.value })
                }
              >
                <option value="">Sin sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-3 md:col-span-2">
            <Button disabled={saving} type="submit">
              {saving ? 'Guardando...' : 'Guardar usuario'}
            </Button>
            <Link
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              href="/settings/users"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export function RolesManager() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canView = hasPermission(user, 'roles.view');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !canView) return;
    void listCompanyRoles()
      .then(setRoles)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo cargar la informacion.',
        ),
      )
      .finally(() => setLoading(false));
  }, [canView, user]);

  const sortedRoles = useMemo(
    () => [...roles].sort((left, right) => left.code.localeCompare(right.code)),
    [roles],
  );

  if (authLoading || (canView && loading)) {
    return (
      <main className="grid min-h-screen place-items-center">Cargando...</main>
    );
  }

  if (!canView) {
    return <AccessDenied title="Roles" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            Configuracion
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Roles</h1>
          <p className="mt-2 text-sm text-slate-600">
            Resumen de roles base. La edicion granular de permisos no esta
            disponible en esta fase.
          </p>
        </header>
        {error && <ErrorMessage message={error} />}
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedRoles.map((role) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              key={role.id}
            >
              <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
                {role.code}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                {role.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {role.description ?? 'Rol base de la empresa.'}
              </p>
              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                Rol predefinido del sistema. La edicion granular no esta
                disponible en esta fase.
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  {role.rolePermissions.length} permisos efectivos
                </summary>
                <ul className="mt-3 grid gap-1 text-xs text-slate-600">
                  {role.rolePermissions.map(({ permission }) => (
                    <li
                      className="rounded-md bg-slate-50 px-2 py-1 font-mono"
                      key={permission.code}
                    >
                      {permission.code}
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function AccessDenied({ title }: { title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          No tienes permiso para realizar esta accion.
        </p>
      </div>
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === 'ACTIVE'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function Field({
  disabled = false,
  label,
  minLength,
  onChange,
  required = false,
  type = 'text',
  value,
}: {
  disabled?: boolean;
  label: string;
  minLength?: number;
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
        disabled={disabled}
        minLength={minLength}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function clean(value: string) {
  return value.trim() || undefined;
}
