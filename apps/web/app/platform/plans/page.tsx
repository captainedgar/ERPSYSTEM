'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import {
  PlatformHeader,
  PlatformMetricCard,
  platformErrorClass,
  platformInputClass,
  platformLabelClass,
  platformLinkClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  createSaasPlan,
  listSaasPlans,
  type SaasBillingInterval,
  type SaasPlan,
} from '@/lib/platform';

const defaultModules = {
  catalog: true,
  inventory: true,
  pos: true,
  fiscalMock: false,
  reports: false,
};

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '1000',
    currency: 'DOP',
    billingInterval: 'MONTHLY' as SaasBillingInterval,
    graceDays: '5',
    maxUsers: '',
    maxBranches: '',
    modules: defaultModules,
  });

  async function refreshPlans() {
    setError('');
    try {
      setPlans(await listSaasPlans());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextPlans = await listSaasPlans();
        if (!cancelled) setPlans(nextPlans);
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await createSaasPlan({
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        currency: form.currency,
        billingInterval: form.billingInterval,
        graceDays: Number(form.graceDays),
        maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
        maxBranches: form.maxBranches ? Number(form.maxBranches) : undefined,
        modules: form.modules,
      });
      setForm((current) => ({ ...current, name: '', description: '' }));
      await refreshPlans();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  const activePlans = plans.filter((plan) => plan.isActive).length;

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Planes SaaS" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <PlatformMetricCard label="Planes" value={plans.length} />
          <PlatformMetricCard
            label="Activos"
            tone="emerald"
            value={activePlans}
          />
          <PlatformMetricCard
            label="Asignaciones"
            value={plans.reduce(
              (total, plan) => total + (plan._count?.subscriptions ?? 0),
              0,
            )}
          />
        </section>
        <section className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
          <form
            className={platformPanelClass}
            onSubmit={(event) => void submit(event)}
          >
            <h2 className="text-lg font-semibold text-slate-950">Nuevo plan</h2>
            <div className="mt-4 grid gap-3">
              <Field
                label="Nombre"
                onChange={(value) =>
                  setForm((current) => ({ ...current, name: value }))
                }
                required
                value={form.name}
              />
              <Field
                label="Descripcion"
                onChange={(value) =>
                  setForm((current) => ({ ...current, description: value }))
                }
                value={form.description}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Precio"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, price: value }))
                  }
                  required
                  type="number"
                  value={form.price}
                />
                <Field
                  label="Gracia"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, graceDays: value }))
                  }
                  required
                  type="number"
                  value={form.graceDays}
                />
              </div>
              <select
                className={platformInputClass}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    billingInterval: event.target.value as SaasBillingInterval,
                  }))
                }
                value={form.billingInterval}
              >
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Max usuarios"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, maxUsers: value }))
                  }
                  type="number"
                  value={form.maxUsers}
                />
                <Field
                  label="Max sucursales"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, maxBranches: value }))
                  }
                  type="number"
                  value={form.maxBranches}
                />
              </div>
              <ModuleToggles
                modules={form.modules}
                onChange={(key, checked) =>
                  setForm((current) => ({
                    ...current,
                    modules: { ...current.modules, [key]: checked },
                  }))
                }
              />
              <Button disabled={submitting} type="submit">
                Crear plan
              </Button>
            </div>
          </form>
          <section className={platformPanelClass}>
            <h2 className="text-lg font-semibold text-slate-950">
              Catalogo de planes
            </h2>
            <div className="mt-4 overflow-x-auto">
              {loading ? (
                <p className="text-sm text-slate-500">Cargando planes...</p>
              ) : plans.length ? (
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-3">Plan</th>
                      <th className="py-3">Precio</th>
                      <th className="py-3">Estado</th>
                      <th className="py-3">Empresas</th>
                      <th className="py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr
                        className="border-t border-slate-200 transition hover:bg-slate-50"
                        key={plan.id}
                      >
                        <td className="py-3">
                          <p className="font-medium text-slate-950">
                            {plan.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {plan.billingInterval}
                          </p>
                        </td>
                        <td className="py-3">{platformMoney(plan.price)}</td>
                        <td className="py-3">
                          <PlanBadge active={plan.isActive} />
                        </td>
                        <td className="py-3">
                          {plan._count?.subscriptions ?? 0}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            className={platformLinkClass}
                            href={`/platform/plans/${plan.id}`}
                          >
                            Editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No hay planes creados todavia.
                </p>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  required,
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
    <label className={platformLabelClass}>
      <span>{label}</span>
      <input
        className={platformInputClass}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function ModuleToggles({
  modules,
  onChange,
}: {
  modules: Record<string, boolean>;
  onChange: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-2">
      {Object.entries(modules).map(([key, checked]) => (
        <label
          className="flex items-center justify-between text-sm font-medium text-slate-700"
          key={key}
        >
          <span>{key}</span>
          <input
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={checked}
            onChange={(event) => onChange(key, event.target.checked)}
            type="checkbox"
          />
        </label>
      ))}
    </div>
  );
}

function PlanBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}
