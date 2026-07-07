import { InternalDocumentDetail } from '@/components/internal-document-detail';

export default async function InternalDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InternalDocumentDetail id={id} />;
}
