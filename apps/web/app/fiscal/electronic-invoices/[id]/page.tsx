import { FiscalInvoiceDetail } from '@/components/fiscal-invoice-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FiscalInvoicePage({ params }: PageProps) {
  const { id } = await params;
  return <FiscalInvoiceDetail id={id} />;
}
