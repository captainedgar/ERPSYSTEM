export const DEFAULT_UNITS = [
  { name: 'Unidad', code: 'UNIT', allowsDecimals: false },
  { name: 'Libra', code: 'LB', allowsDecimals: true },
  { name: 'Metro', code: 'M', allowsDecimals: true },
  { name: 'Galón', code: 'GAL', allowsDecimals: true },
  { name: 'Caja', code: 'BOX', allowsDecimals: false },
  { name: 'Paquete', code: 'PACK', allowsDecimals: false },
] as const;
