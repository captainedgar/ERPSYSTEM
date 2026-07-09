'use client';

import { useEffect, useState } from 'react';

import {
  PlatformCompanyTable,
  PlatformHeader,
  platformErrorClass,
  platformPanelClass,
} from '@/components/platform-ui';
import { listPlatformCompanies, type PlatformCompany } from '@/lib/platform';

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void listPlatformCompanies()
      .then(setCompanies)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Error'),
      );
  }, []);

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <PlatformHeader title="Empresas registradas" />
        {error && <p className={platformErrorClass}>{error}</p>}
        <section className={`mt-6 ${platformPanelClass}`}>
          <PlatformCompanyTable companies={companies} />
        </section>
      </div>
    </main>
  );
}
