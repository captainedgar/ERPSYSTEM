import { CashSessionDetail } from '@/components/cash-session-detail';

export default async function CashSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CashSessionDetail cashSessionId={id} />;
}
