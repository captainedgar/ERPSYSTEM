import { BranchFormPage } from '@/components/branches-manager';

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BranchFormPage branchId={id} />;
}
