'use client';

import { useEffect, useState } from 'react';

import {
  PlatformCompanyTable,
  PlatformHeader,
  platformErrorClass,
  platformErrorMessage,
  platformPanelClass,
} from '@/components/platform-ui';
import {
  listBillingSubscriptions,
  listPlatformCompanies,
  type CompanySubscription,
  type PlatformCompany,
} from '@/lib/platform';

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      try {
        const [nextCompanies, nextSubscriptions] = await Promise.all([
          listPlatformCompanies(),
          listBillingSubscriptions(),
        ]);
        if (cancelled) return;
        setCompanies(nextCompanies);
        setSubscriptions(nextSubscriptions);
      } catch (reason) {
        if (!cancelled) {
          setError(
            platformErrorMessage('No se pudieron cargar las empresas.', reason),
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
  }, []);

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Empresas registradas" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className={`mt-6 ${platformPanelClass}`}>
          {loading ? (
            <p className="text-sm text-slate-600">Cargando empresas...</p>
          ) : (
            <PlatformCompanyTable
              companies={companies}
              subscriptions={subscriptions}
            />
          )}
        </section>
      </div>
    </main>
  );
}
