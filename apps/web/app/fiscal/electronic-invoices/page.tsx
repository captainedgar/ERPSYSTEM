import { Suspense } from 'react';

import { FiscalInvoicesManager } from '@/components/fiscal-invoices-manager';

export default function FiscalElectronicInvoicesPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          Cargando fiscal...
        </main>
      }
    >
      <FiscalInvoicesManager />
    </Suspense>
  );
}
