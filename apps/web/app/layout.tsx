import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppDashboardShell } from '@/components/app-dashboard-shell';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Comercia ERP',
  description: 'ERP y punto de venta para negocios dominicanos.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <AppDashboardShell>{children}</AppDashboardShell>
        </AuthProvider>
      </body>
    </html>
  );
}
