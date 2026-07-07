import { Suspense } from 'react';

import { InternalDocumentsManager } from '@/components/internal-documents-manager';

export default function InternalDocumentsPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          Cargando documentos...
        </main>
      }
    >
      <InternalDocumentsManager />
    </Suspense>
  );
}
