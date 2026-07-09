'use client';

import { Button } from '@comercia/ui';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import {
  PlatformHeader,
  platformErrorClass,
  platformInputClass,
  platformLabelClass,
  platformMoney,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  getSaasPlan,
  updateSaasPlan,
  updateSaasPlanStatus,
  type SaasBillingInterval,
  type SaasPlan,
} from '@/lib/platform';

export default function PlatformPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<SaasPlan | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSaasPlan(params.id)
      .then((nextPlan) => {
        if (!cancelled) setPlan(nextPlan);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) return;
    setSubmitting(true);
    setError('');
    try {
      setPlan(
        await updateSaasPlan(plan.id, {
          name: plan.name,
          description: plan.description ?? undefined,
          price: Number(plan.price),
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          graceDays: plan.graceDays,
          maxUsers: plan.maxUsers,
          maxBranches: plan.maxBranches,
          modules: plan.modules,
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(isActive: boolean) {
    if (!plan) return;
    setSubmitting(true);
    setError('');
    try {
      setPlan(await updateSaasPlanStatus(plan.id, isActive));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!plan) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        {error || 'Cargando plan...'}
      </main>
    );
  }

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PlatformHeader title={plan.name} />
          <Button onClick={() => router.push('/platform/plans')} type="button">
            Volver
          </Button>
        </div>
        {error && <p className={platformErrorClass}>{error}</p>}
        <form
          className={`mt-6 ${platformPanelClass}`}
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nombre"
              onChange={(value) =>
                setPlan((current) =>
                  current ? { ...current, name: value } : current,
                )
              }
              value={plan.name}
            />
            <Field
              label="Precio"
              onChange={(value) =>
                setPlan((current) =>
                  current ? { ...current, price: value } : current,
                )
              }
              type="number"
              value={String(plan.price)}
            />
            <Field
              label="Descripcion"
              onChange={(value) =>
                setPlan((current) =>
                  current ? { ...current, description: value } : current,
                )
              }
              value={plan.description ?? ''}
            />
            <label className={platformLabelClass}>
              <span>Intervalo</span>
              <select
                className={platformInputClass}
                onChange={(event) =>
                  setPlan((current) =>
                    current
                      ? {
                          ...current,
                          billingInterval: event.target
                            .value as SaasBillingInterval,
                        }
                      : current,
                  )
                }
                value={plan.billingInterval}
              >
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </select>
            </label>
            <Field
              label="Dias de gracia"
              onChange={(value) =>
                setPlan((current) =>
                  current ? { ...current, graceDays: Number(value) } : current,
                )
              }
              type="number"
              value={String(plan.graceDays)}
            />
            <Field
              label="Max usuarios"
              onChange={(value) =>
                setPlan((current) =>
                  current
                    ? { ...current, maxUsers: value ? Number(value) : null }
                    : current,
                )
              }
              type="number"
              value={String(plan.maxUsers ?? '')}
            />
            <Field
              label="Max sucursales"
              onChange={(value) =>
                setPlan((current) =>
                  current
                    ? { ...current, maxBranches: value ? Number(value) : null }
                    : current,
                )
              }
              type="number"
              value={String(plan.maxBranches ?? '')}
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Resumen</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {platformMoney(plan.price)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {plan._count?.subscriptions ?? 0} empresas asignadas
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={submitting} type="submit">
              Guardar cambios
            </Button>
            <Button
              disabled={submitting || !plan.isActive}
              onClick={() => void changeStatus(false)}
              type="button"
              variant="secondary"
            >
              Desactivar
            </Button>
            <Button
              disabled={submitting || plan.isActive}
              onClick={() => void changeStatus(true)}
              type="button"
            >
              Activar
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  onChange,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className={platformLabelClass}>
      <span>{label}</span>
      <input
        className={platformInputClass}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}
