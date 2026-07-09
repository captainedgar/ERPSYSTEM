'use client';

import { Button } from '@comercia/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { CompanyLogo } from '@/components/company-logo';

const publicRoutes = ['/', '/login', '/register', '/onboarding/business'];

const navSections = [
  {
    title: 'Operaciones',
    items: [
      { href: '/dashboard', label: 'Dashboard', roles: ['ALL'] },
      {
        href: '/pos',
        label: 'POS',
        roles: ['OWNER', 'ADMIN', 'CASHIER', 'SELLER'],
      },
      {
        href: '/sales',
        label: 'Ventas',
        roles: ['OWNER', 'ADMIN', 'CASHIER', 'SELLER', 'ACCOUNTING'],
      },
      {
        href: '/cash',
        label: 'Caja',
        roles: ['OWNER', 'ADMIN', 'CASHIER', 'SELLER', 'ACCOUNTING'],
      },
      {
        href: '/customers',
        label: 'Clientes',
        roles: ['OWNER', 'ADMIN', 'CASHIER', 'SELLER', 'ACCOUNTING'],
      },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { href: '/catalog/products', label: 'Productos', roles: ['ALL'] },
      { href: '/catalog/services', label: 'Servicios', roles: ['ALL'] },
      {
        href: '/catalog/categories',
        label: 'Categorías',
        roles: ['OWNER', 'ADMIN', 'WAREHOUSE'],
      },
      {
        href: '/catalog/brands',
        label: 'Marcas',
        roles: ['OWNER', 'ADMIN', 'WAREHOUSE'],
      },
      {
        href: '/catalog/units',
        label: 'Unidades',
        roles: ['OWNER', 'ADMIN', 'WAREHOUSE'],
      },
    ],
  },
  {
    title: 'Control',
    items: [
      { href: '/inventory', label: 'Inventario', roles: ['ALL'] },
      { href: '/inventory/low-stock', label: 'Stock bajo', roles: ['ALL'] },
      {
        href: '/internal-documents',
        label: 'Documentos internos',
        roles: ['OWNER', 'ADMIN', 'CASHIER', 'SELLER', 'ACCOUNTING'],
      },
      {
        href: '/fiscal/electronic-invoices',
        label: 'Fiscal mock',
        roles: ['OWNER', 'ADMIN', 'CASHIER', 'ACCOUNTING'],
      },
      {
        href: '/fiscal/settings',
        label: 'Config. fiscal',
        roles: ['OWNER', 'ADMIN', 'ACCOUNTING'],
      },
    ],
  },
  {
    title: 'Configuración',
    items: [
      {
        href: '/settings/business',
        label: 'Negocio',
        roles: ['OWNER', 'ADMIN'],
      },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, logout, user } = useAuth();
  const [open, setOpen] = useState(false);

  const isPublic = publicRoutes.includes(pathname);
  const visibleSections = useMemo(() => {
    const role = user?.role.code ?? '';
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.roles.includes('ALL') || item.roles.includes(role),
        ),
      }))
      .filter((section) => section.items.length);
  }, [user?.role.code]);

  if (isPublic || loading || !user) return <>{children}</>;

  return (
    <div className="app-shell min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--app-border)] bg-white/95 px-4 py-5 shadow-sm backdrop-blur transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <CompanyLogo
              logoUrl={user.company.logoUrl}
              name={user.company.name}
              size="sm"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                {user.company.name}
              </span>
              <span className="block text-xs text-slate-500">Comercia ERP</span>
            </span>
          </Link>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden"
            type="button"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </button>
        </div>

        <nav className="mt-8 space-y-6">
          {visibleSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {section.title}
              </p>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                      href={item.href}
                      key={item.href}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {open && (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          type="button"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden"
                type="button"
                onClick={() => setOpen(true)}
              >
                Menú
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {user.company.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {user.branch?.name ?? 'Sin sucursal'} · {user.role.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {['OWNER', 'ADMIN', 'CASHIER', 'SELLER'].includes(
                user.role.code,
              ) && (
                <Link
                  className="hidden rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:inline-flex"
                  href="/pos"
                >
                  Abrir POS
                </Link>
              )}
              <Button
                variant="secondary"
                onClick={() => void logout().then(() => router.push('/login'))}
              >
                Salir
              </Button>
            </div>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
