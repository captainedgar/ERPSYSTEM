import { PosItemType, type PosItem } from './pos';

export interface PosCartLine extends PosItem {
  quantity: number;
  discountAmount: number;
}

export type AddToCartResult =
  | { ok: true; cart: PosCartLine[]; message: string }
  | { ok: false; cart: PosCartLine[]; message: string };

export function addPosItemToCart(
  cart: PosCartLine[],
  item: PosItem,
): AddToCartResult {
  const existing = cart.find(
    (line) => line.id === item.id && line.type === item.type,
  );
  const nextQuantity = roundQuantity((existing?.quantity ?? 0) + 1);
  const stockMessage = getStockMessage(item, nextQuantity);

  if (stockMessage) {
    return { ok: false, cart, message: stockMessage };
  }

  if (existing) {
    return {
      ok: true,
      cart: cart.map((line) =>
        line === existing ? { ...line, quantity: nextQuantity } : line,
      ),
      message: 'Cantidad actualizada.',
    };
  }

  return {
    ok: true,
    cart: [...cart, { ...item, quantity: 1, discountAmount: 0 }],
    message: 'Producto agregado.',
  };
}

function getStockMessage(item: PosItem, nextQuantity: number) {
  if (item.type !== PosItemType.PRODUCT || !item.trackInventory) return null;

  const stock = Number(item.stock ?? 0);
  if (!Number.isFinite(stock) || nextQuantity <= stock) return null;

  return stock <= 0
    ? 'Producto sin stock disponible.'
    : `No hay stock suficiente. Disponible: ${stock}.`;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
