import { InventoryMovementsPage } from '@/components/inventory-movements-page';

export default async function InventoryProductMovementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InventoryMovementsPage productId={id} />;
}
