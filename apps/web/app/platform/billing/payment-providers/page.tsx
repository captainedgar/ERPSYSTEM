'use client';

import { useEffect, useState } from 'react';
import { PlatformHeader, platformPanelClass } from '@/components/platform-ui';
import { listPaymentProviders } from '@/lib/platform';

type Provider = Awaited<ReturnType<typeof listPaymentProviders>>[number];

export default function PaymentProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    void listPaymentProviders()
      .then(setProviders)
      .catch((reason: Error) => setError(reason.message));
  }, []);
  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <PlatformHeader title="Proveedores de pago" />
        {error && <p className="mt-4 text-red-700">{error}</p>}
        {providers.map((provider) => (
          <section
            className={`mt-6 ${platformPanelClass}`}
            key={provider.provider}
          >
            <h2 className="text-lg font-semibold">
              PayPal Checkout · {provider.environment}
            </h2>
            <p className="mt-2 text-sm">
              Credenciales:{' '}
              {provider.configured ? 'configuradas' : 'no configuradas'} ·
              Webhook:{' '}
              {provider.webhookConfigured ? 'configurado' : 'no configurado'} ·
              Estado: {provider.status}
            </p>
            {!provider.configured && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Pago online no configurado. Configure PAYPAL_CLIENT_ID,
                PAYPAL_CLIENT_SECRET y PAYPAL_WEBHOOK_ID.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Los secretos nunca se muestran en Platform Admin.
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
