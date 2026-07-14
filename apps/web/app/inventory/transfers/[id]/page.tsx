'use client';

import { useParams } from 'next/navigation';

import { InventoryTransferDetail } from '@/components/inventory-transfer-detail';

export default function InventoryTransferDetailPage() {
  const params = useParams<{ id: string }>();
  return <InventoryTransferDetail transferId={params.id} />;
}
