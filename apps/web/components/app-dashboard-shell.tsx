'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useAuth, type AuthUser } from '@/components/auth-provider';
import { getStoredActiveBranchId, storeActiveBranchId } from '@/lib/api';
import { listAvailableBranches, type AvailableBranch } from '@/lib/branches';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';

const navGroups = [
  {
    label: 'Operacion',
    items: [
      { href: '/dashboard', label: 'Panel', marker: 'PA' },
      { href: '/pos', label: 'POS', marker: 'PO', permissions: ['pos.access'] },
      {
        href: '/sales',
        label: 'Ventas',
        marker: 'VE',
        permissions: ['sales.view'],
      },
      {
        href: '/cash',
        label: 'Caja',
        marker: 'CJ',
        permissions: ['cash.view'],
      },
    ],
  },
  {
    label: 'Inventario',
    items: [
      {
        href: '/inventory',
        label: 'Inventario',
        marker: 'IN',
        permissions: ['inventory.view'],
      },
      {
        href: '/inventory/low-stock',
        label: 'Bajo stock',
        marker: 'BS',
        permissions: ['inventory.view_low_stock'],
      },
      {
        href: '/inventory/transfers',
        label: 'Transferencias',
        marker: 'TR',
        permissions: ['inventory.transfer'],
      },
    ],
  },
  {
    label: 'Catalogo',
    items: [
      {
        href: '/catalog/products',
        label: 'Productos',
        marker: 'PR',
        permissions: ['products.view'],
      },
      {
        href: '/catalog/services',
        label: 'Servicios',
        marker: 'SV',
        permissions: ['services.view'],
      },
      {
        href: '/catalog/categories',
        label: 'Categorias',
        marker: 'CT',
        permissions: ['categories.view'],
      },
      {
        href: '/catalog/brands',
        label: 'Marcas',
        marker: 'MA',
        permissions: ['brands.view'],
      },
      {
        href: '/catalog/units',
        label: 'Unidades',
        marker: 'UN',
        permissions: ['units.view'],
      },
      {
        href: '/catalog/products/import',
        label: 'Importar Excel',
        marker: 'IM',
        permissions: ['products.import'],
      },
      {
        href: '/catalog/compatibility',
        label: 'Compatibilidad',
        marker: 'CP',
        permissions: ['product_compatibility.view'],
      },
    ],
  },
  {
    label: 'Administracion',
    items: [
      {
        href: '/customers',
        label: 'Clientes',
        marker: 'CL',
        permissions: ['customers.view'],
      },
      {
        href: '/internal-documents',
        label: 'Docs internos',
        marker: 'DI',
        permissions: ['internal_documents.view'],
      },
    ],
  },
  {
    label: 'Analitica',
    items: [
      {
        href: '/reports',
        label: 'Reportes',
        marker: 'RE',
        permissions: ['reports.view'],
      },
      {
        href: '/reports/sales',
        label: 'Reporte ventas',
        marker: 'RV',
        permissions: ['reports.sales'],
      },
      {
        href: '/reports/cash',
        label: 'Reporte caja',
        marker: 'RC',
        permissions: ['reports.cash'],
      },
      {
        href: '/reports/inventory',
        label: 'Reporte inventario',
        marker: 'RI',
        permissions: ['reports.inventory'],
      },
      {
        href: '/reports/customers',
        label: 'Reporte clientes',
        marker: 'RL',
        permissions: ['reports.customers'],
      },
      {
        href: '/reports/documents',
        label: 'Reporte docs',
        marker: 'RD',
        permissions: ['reports.documents'],
      },
      {
        href: '/financial-dashboard',
        label: 'Dashboard financiero',
        marker: 'FI',
        permissions: ['financial_dashboard.view'],
      },
      {
        href: '/data-export',
        label: 'Exportar datos',
        marker: 'EX',
        permissions: ['data_export.view'],
      },
    ],
  },
  {
    label: 'Configuracion',
    items: [
      {
        href: '/settings/business',
        label: 'Empresa',
        marker: 'EM',
        permissions: ['settings.view'],
      },
      {
        href: '/settings/branches',
        label: 'Sucursales',
        marker: 'SU',
        permissions: ['branches.view'],
      },
      {
        href: '/settings/users',
        label: 'Usuarios',
        marker: 'US',
        permissions: ['users.view'],
      },
      {
        href: '/settings/roles',
        label: 'Roles',
        marker: 'RO',
        permissions: ['roles.view'],
      },
      {
        href: '/fiscal/settings',
        label: 'Fiscal / e-CF',
        marker: 'FC',
        permissions: ['fiscal.settings.view', 'fiscal.documents.view'],
      },
    ],
  },
];

type NavItemDefinition = (typeof navGroups)[number]['items'][number];

const dashboardPrefixes = [
  '/dashboard',
  '/pos',
  '/sales',
  '/cash',
  '/customers',
  '/catalog',
  '/inventory',
  '/internal-documents',
  '/data-export',
  '/reports',
  '/financial-dashboard',
  '/settings',
  '/fiscal',
];

const excludedPrefixes = ['/platform'];
const excludedExact = new Set(['/', '/login', '/register', '/suspended']);

export function AppDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const usesDashboardShell = shouldUseDashboardShell(pathname);
  const [branches, setBranches] = useState<AvailableBranch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [switchingBranch, setSwitchingBranch] = useState(false);

  useEffect(() => {
    if (!user || !usesDashboardShell) return;
    let cancelled = false;
    const loadBranches = () =>
      void listAvailableBranches()
        .then((response) => {
          if (cancelled) return;
          setBranches(response.items);
          const stored = getStoredActiveBranchId();
          const nextBranchId =
            response.items.find((branch) => branch.id === stored)?.id ??
            response.activeBranchId ??
            response.defaultBranchId ??
            response.items[0]?.id ??
            null;
          setActiveBranchId(nextBranchId);
          if (nextBranchId) storeActiveBranchId(nextBranchId);
        })
        .catch(() => {
          if (!cancelled) setBranches([]);
        })
        .finally(() => {
          if (!cancelled) setBranchesLoading(false);
        });
    loadBranches();
    window.addEventListener('comercia:branches-updated', loadBranches);
    return () => {
      cancelled = true;
      window.removeEventListener('comercia:branches-updated', loadBranches);
    };
  }, [usesDashboardShell, user]);

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeNavItem(user, item)),
    }))
    .filter((group) => group.items.length > 0);
  const navItems = visibleNavGroups.flatMap((group) => group.items);

  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId) ?? null,
    [activeBranchId, branches],
  );

  if (!usesDashboardShell) return <>{children}</>;

  const activeItem = navItems.find((item) => isActive(pathname, item.href));

  function selectBranch(branchId: string) {
    if (!branchId || branchId === activeBranchId) return;
    setSwitchingBranch(true);
    setActiveBranchId(branchId);
    storeActiveBranchId(branchId);
    window.setTimeout(() => setSwitchingBranch(false), 450);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-hidden border-r border-slate-200 bg-white px-6 py-6 shadow-sm lg:block">
        <Link href="/dashboard" className="block min-w-0">
          <p className="truncate text-sm font-semibold text-blue-700">
            Comercia ERP
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold text-slate-950">
            Panel operativo
          </h1>
        </Link>

        <nav className="mt-8 grid gap-7">
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                {group.label}
              </p>
              <div className="mt-2 grid gap-1">
                {group.items.map((item) => (
                  <NavItem
                    active={isActive(pathname, item.href)}
                    href={item.href}
                    key={item.href}
                    label={item.label}
                    marker={item.marker}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute right-5 bottom-5 left-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Empresa activa
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-950">
            {user?.company.name ?? 'Sin empresa'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {activeBranch?.name ?? user?.branch?.name ?? 'Sucursal principal'}
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {activeItem?.label ?? 'Comercia ERP'}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">
                {user?.company.name ?? 'Panel de empresa'}
              </h2>
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0">
              <BranchSelector
                activeBranch={activeBranch}
                activeBranchId={activeBranchId}
                branches={branches}
                loading={branchesLoading}
                switching={switchingBranch}
                userBranchName={user?.branch?.name}
                onSelect={selectBranch}
              />
              <span className="hidden text-slate-300 sm:block">/</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Rol
                </p>
                <p className="truncate text-sm font-medium text-slate-700">
                  {user?.role.name ?? 'Sin rol'}
                </p>
              </div>
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
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
      href={href}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-md text-[11px] font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {marker}
      </span>
      {label}
    </Link>
  );
}

function BranchSelector({
  activeBranch,
  activeBranchId,
  branches,
  loading,
  onSelect,
  switching,
  userBranchName,
}: {
  activeBranch: AvailableBranch | null;
  activeBranchId: string | null;
  branches: AvailableBranch[];
  loading: boolean;
  onSelect: (branchId: string) => void;
  switching: boolean;
  userBranchName?: string;
}) {
  const fallbackLabel =
    activeBranch?.name ?? userBranchName ?? 'Sucursal principal';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canChoose = branches.length > 1 && !loading && !switching;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function chooseBranch(branchId: string) {
    setOpen(false);
    onSelect(branchId);
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!canChoose) return;
    if (
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      setOpen(true);
    }
    if (event.key === 'Escape') setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="relative grid min-w-0 gap-1.5 sm:min-w-[220px]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Sucursal activa
        </span>
        {switching && (
          <span className="text-xs font-medium text-blue-600">
            Cambiando...
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 font-medium text-slate-500 shadow-sm sm:w-[240px]">
          Cargando sucursales...
        </div>
      ) : branches.length > 1 ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 pr-3 text-left text-sm leading-5 font-semibold text-slate-900 shadow-sm transition hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-500 sm:w-[240px] xl:w-[260px]"
            disabled={switching}
            type="button"
            onClick={() => {
              if (canChoose) setOpen((current) => !current);
            }}
            onKeyDown={handleButtonKeyDown}
          >
            <span className="truncate leading-5">{fallbackLabel}</span>
            <span
              aria-hidden="true"
              className={`shrink-0 text-slate-400 transition ${
                open ? 'rotate-180' : ''
              }`}
            >
              v
            </span>
          </button>

          {open && (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5 sm:w-[240px] xl:w-[260px]">
              <div className="max-h-72 overflow-y-auto py-1" role="listbox">
                {branches.map((branch) => {
                  const selected = branch.id === activeBranchId;
                  return (
                    <button
                      aria-selected={selected}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                        selected
                          ? 'bg-blue-50 font-semibold text-blue-700'
                          : 'text-slate-800'
                      }`}
                      key={branch.id}
                      role="option"
                      type="button"
                      onClick={() => chooseBranch(branch.id)}
                    >
                      <span className="truncate">{branch.name}</span>
                      {selected && (
                        <span aria-hidden="true" className="text-blue-600">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : branches.length === 1 || activeBranch || userBranchName ? (
        <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 font-semibold text-slate-900 shadow-sm sm:w-[240px]">
          <span className="truncate leading-5">{fallbackLabel}</span>
        </div>
      ) : (
        <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white px-4 text-sm leading-5 font-medium text-slate-500 shadow-sm sm:w-[240px]">
          Sin sucursales disponibles
        </div>
      )}
    </div>
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

function canSeeNavItem(user: AuthUser | null, item: NavItemDefinition) {
  const permissions = 'permissions' in item ? item.permissions : undefined;
  if (!permissions?.length) return true;
  if (permissions.length === 1) {
    return hasPermission(user, permissions[0]!);
  }
  return hasAnyPermission(user, permissions);
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href;
  if (href === '/catalog/products') {
    return pathname === href || pathname.startsWith('/catalog/products/');
  }
  if (href === '/reports') return pathname === href;
  if (href === '/settings/business') return pathname === href;
  if (href === '/fiscal/settings') return pathname.startsWith('/fiscal');
  return pathname === href || pathname.startsWith(`${href}/`);
}
