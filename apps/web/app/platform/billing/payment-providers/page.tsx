'use client';

import { useEffect, useState } from 'react';
import { usePlatformUser } from '@/components/platform-shell';
import { PlatformHeader, platformPanelClass } from '@/components/platform-ui';
import { listPaymentProviders, testPayPalConnection } from '@/lib/platform';

type Provider = Awaited<ReturnType<typeof listPaymentProviders>>[number];
type TestResult = Awaited<ReturnType<typeof testPayPalConnection>>;

export default function PaymentProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const user = usePlatformUser();

  useEffect(() => {
    void listPaymentProviders()
      .then(setProviders)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  async function runConnectionTest() {
    setTesting(true);
    setError('');
    try {
      setTestResult(await testPayPalConnection());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo probar PayPal.',
      );
    } finally {
      setTesting(false);
    }
  }

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
              PayPal Checkout - {provider.environment}
            </h2>
            {user?.role === 'SUPER_ADMIN' && (
              <button
                className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={testing}
                onClick={() => void runConnectionTest()}
                type="button"
              >
                {testing ? 'Probando...' : 'Probar conexion PayPal'}
              </button>
            )}
            {testResult && (
              <p
                className={`mt-3 rounded-lg p-3 text-sm ${
                  testResult.reachable
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                Resultado sandbox:{' '}
                {testResult.reachable ? 'conectado' : 'no conectado'} - probado
                en {new Date(testResult.testedAt).toLocaleString()}
                {testResult.error ? ` - ${testResult.error}` : ''}
              </p>
            )}
            <p className="mt-2 text-sm">
              Credenciales:{' '}
              {provider.configured ? 'configuradas' : 'no configuradas'} -
              Webhook:{' '}
              {provider.webhookConfigured ? 'configurado' : 'no configurado'} -
              Estado: {provider.status}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">Client ID</dt>
                <dd>
                  {provider.clientIdConfigured
                    ? 'Configurado'
                    : 'No configurado'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Client Secret</dt>
                <dd>
                  {provider.clientSecretConfigured
                    ? 'Configurado'
                    : 'No configurado'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">APP_PUBLIC_URL</dt>
                <dd>
                  {provider.appPublicUrlConfigured
                    ? 'Configurada'
                    : 'No configurada'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">API_PUBLIC_URL</dt>
                <dd>
                  {provider.apiPublicUrlConfigured
                    ? 'Configurada'
                    : 'No configurada'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Moneda checkout</dt>
                <dd>{provider.checkoutCurrency}</dd>
              </div>
              <div>
                <dt className="font-medium">Politica monetaria</dt>
                <dd>
                  {provider.currencySupported
                    ? 'Conversion configurada'
                    : 'No disponible'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Tasa DOP/USD</dt>
                <dd>
                  {provider.dopUsdRate
                    ? `${provider.dopUsdRate.toFixed(2)} DOP/USD`
                    : 'No configurada'}
                </dd>
              </div>
            </dl>
            {provider.warning && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {provider.warning}
              </p>
            )}
            {!provider.configured && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Pago online no configurado. Revise credenciales, URLs públicas,
                entorno y política monetaria.
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
