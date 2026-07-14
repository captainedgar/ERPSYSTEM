'use client';

import { useParams } from 'next/navigation';

import { FiscalInvoiceDetail } from '@/components/fiscal-managers';

export default function FiscalElectronicInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  return <FiscalInvoiceDetail invoiceId={params.id} />;
}
