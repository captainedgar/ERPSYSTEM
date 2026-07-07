import { InternalDocumentPrint } from '@/components/internal-document-print';

export default async function InternalDocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InternalDocumentPrint id={id} />;
}
