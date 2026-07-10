'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';

const navItems = [
  { href: '/dashboard', label: 'Panel', marker: 'PA' },
  { href: '/pos', label: 'POS', marker: 'PO' },
  { href: '/sales', label: 'Ventas', marker: 'VE' },
  { href: '/cash', label: 'Caja', marker: 'CJ' },
  { href: '/customers', label: 'Clientes', marker: 'CL' },
  { href: '/catalog/products', label: 'Catalogo', marker: 'CA' },
  { href: '/inventory', label: 'Inventario', marker: 'IN' },
  { href: '/internal-documents', label: 'Docs internos', marker: 'DI' },
  { href: '/settings/business', label: 'Configuracion', marker: 'CO' },
];

const dashboardPrefixes = [
  '/dashboard',
  '/pos',
  '/sales',
  '/cash',
  '/customers',
  '/catalog',
  '/inventory',
  '/internal-documents',
  '/settings',
  '/fiscal',
];

const excludedPrefixes = ['/platform'];
const excludedExact = new Set(['/', '/login', '/register', '/suspended']);

export function AppDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!shouldUseDashboardShell(pathname)) return <>{children}</>;

  const activeItem = navItems.find((item) => isActive(pathname, item.href));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 shadow-sm lg:block">
        <Link href="/dashboard" className="block">
          <p className="text-sm font-semibold text-blue-700">Comercia ERP</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">
            Panel operativo
          </h1>
        </Link>

        <nav className="mt-8 grid gap-2">
          {navItems.map((item) => (
            <NavItem
              active={isActive(pathname, item.href)}
              href={item.href}
              key={item.href}
              label={item.label}
              marker={item.marker}
            />
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {activeItem?.label ?? 'Comercia ERP'}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                {user?.company.name ?? 'Panel de empresa'}
              </h2>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>{user?.branch?.name ?? 'Sucursal principal'}</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span className="hidden sm:inline">{user?.role.name}</span>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <Link
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${
                  isActive(pathname, item.href)
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="min-h-[calc(100vh-73px)]">{children}</div>
      </div>
    </div>
  );
}

function NavItem({
  active,
  href,
  label,
  marker,
}: {
  active: boolean;
  href: string;
  label: string;
  marker: string;
}) {
  return (
    <Link
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
      href={href}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg text-[11px] font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {marker}
      </span>
      {label}
    </Link>
  );
}

function shouldUseDashboardShell(pathname: string) {
  if (excludedExact.has(pathname)) return false;
  if (pathname.endsWith('/print')) return false;
  if (excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return dashboardPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  if (href === '/catalog/products') return pathname.startsWith('/catalog');
  return pathname === href || pathname.startsWith(`${href}/`);
}
