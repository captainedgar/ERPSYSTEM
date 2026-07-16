'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  clearPlatformToken,
  getPlatformMe,
  getPlatformToken,
  platformLogout,
  type PlatformUser,
} from '@/lib/platform';

interface PlatformNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

interface PlatformNavSection {
  label: string;
  roles?: PlatformUser['role'][];
  items: PlatformNavItem[];
}

const nav: PlatformNavSection[] = [
  {
    label: 'Inicio',
    items: [{ href: '/platform/dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Clientes SaaS',
    items: [
      { href: '/platform/companies', label: 'Empresas' },
      { href: '/platform/billing', label: 'Suscripciones', exact: true },
    ],
  },
  {
    label: 'Facturacion SaaS',
    roles: ['SUPER_ADMIN', 'BILLING_ADMIN', 'AUDITOR'],
    items: [
      { href: '/platform/plans', label: 'Planes' },
      { href: '/platform/billing/invoices', label: 'Facturas' },
      { href: '/platform/billing/payments', label: 'Pagos' },
    ],
  },
  {
    label: 'Operacion',
    items: [{ href: '/platform/audit', label: 'Auditoria' }],
  },
];

const PlatformUserContext = createContext<PlatformUser | null>(null);

export function usePlatformUser() {
  return useContext(PlatformUserContext);
}

export function canManageBilling(user: PlatformUser | null) {
  return user?.role === 'SUPER_ADMIN' || user?.role === 'BILLING_ADMIN';
}

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(pathname !== '/platform/login');

  useEffect(() => {
    if (pathname === '/platform/login') return;
    if (!getPlatformToken()) {
      router.replace('/platform/login');
      return;
    }
    void getPlatformMe()
      .then(setUser)
      .catch(() => {
        clearPlatformToken();
        router.replace('/platform/login');
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  if (pathname === '/platform/login') return <>{children}</>;
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-700">
        Cargando...
      </main>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 shadow-sm lg:block">
        <Link href="/platform/dashboard">
          <p className="text-sm font-semibold text-blue-700">Comercia ERP</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">
            Platform Admin
          </h1>
        </Link>
        <nav className="mt-8 grid gap-6">
          {nav
            .filter(
              (section) => !section.roles || section.roles.includes(user.role),
            )
            .map((section) => (
              <div key={section.label}>
                <p className="px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {section.label}
                </p>
                <div className="mt-2 grid gap-1">
                  {section.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (!item.exact && pathname.startsWith(`${item.href}/`));
                    return (
                      <Link
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                        }`}
                        href={item.href}
                        key={item.href}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {user.name}
              </p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={() =>
                void platformLogout().finally(() => {
                  clearPlatformToken();
                  router.push('/platform/login');
                })
              }
              type="button"
            >
              Salir
            </button>
          </div>
        </header>
        <PlatformUserContext.Provider value={user}>
          {children}
        </PlatformUserContext.Provider>
      </div>
    </div>
  );
}
