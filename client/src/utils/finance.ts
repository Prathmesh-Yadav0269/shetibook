export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'credit' | 'other';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type HarvestUnit = 'kg' | 'quintal' | 'tonne';

/**
 * Converts rupees (number or string) to positive integer paise
 */
export function toPaise(rupees: number | string): number {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num) || num < 0) {
    throw new Error('रक्कम वैध व सकारात्मक असावी (Amount must be non-negative).');
  }
  return Math.round(num * 100);
}

/**
 * Converts integer paise to rupees
 */
export function fromPaise(paise: number): number {
  if (isNaN(paise) || paise < 0) return 0;
  return paise / 100;
}

/**
 * Formats integer paise into localized currency string with ₹ symbol
 */
export function formatCurrency(paise: number, lang: 'mr' | 'en' = 'mr'): string {
  const rupees = (paise || 0) / 100;
  const formattedNumber = new Intl.NumberFormat(lang === 'mr' ? 'mr-IN' : 'en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);

  return `₹${formattedNumber}`;
}

/**
 * Derives payment status based on total amount and paid amount
 */
export function derivePaymentStatus(totalPaise: number, paidPaise: number): PaymentStatus {
  if (paidPaise >= totalPaise) return 'paid';
  if (paidPaise > 0) return 'partial';
  return 'unpaid';
}

/**
 * Normalizes harvest/produce quantity to kilograms (kg)
 */
export function toKg(quantity: number, unit: HarvestUnit): number {
  if (quantity <= 0 || !Number.isFinite(quantity)) {
    throw new Error('प्रमाण सकारात्मक असावे (Quantity must be positive).');
  }

  switch (unit) {
    case 'kg':
      return quantity;
    case 'quintal':
      return quantity * 100;
    case 'tonne':
      return quantity * 1000;
    default:
      throw new Error(`अवैध एकक (Unsupported harvest unit): ${unit}`);
  }
}

/**
 * Converts quantity from kilograms (kg) to target unit
 */
export function fromKg(kg: number, targetUnit: HarvestUnit): number {
  if (kg < 0 || !Number.isFinite(kg)) {
    throw new Error('प्रमाण सकारात्मक असावे (Kg must be non-negative).');
  }

  switch (targetUnit) {
    case 'kg':
      return kg;
    case 'quintal':
      return kg / 100;
    case 'tonne':
      return kg / 1000;
    default:
      throw new Error(`अवैध एकक (Unsupported harvest unit): ${targetUnit}`);
  }
}

/**
 * Converts quantity directly between any two harvest units
 */
export function convertHarvestQuantity(quantity: number, fromUnit: HarvestUnit, toUnit: HarvestUnit): number {
  if (fromUnit === toUnit) return quantity;
  const kg = toKg(quantity, fromUnit);
  return fromKg(kg, toUnit);
}

/**
 * Formats quantity with localized unit
 */
export function formatQuantity(quantity: number, unit: HarvestUnit, lang: 'mr' | 'en' = 'mr'): string {
  const labels: Record<HarvestUnit, { mr: string; en: string }> = {
    kg: { mr: 'किलो', en: 'kg' },
    quintal: { mr: 'क्विंटल', en: 'quintal' },
    tonne: { mr: 'टन', en: 'tonne' },
  };

  const rounded = Number(quantity.toFixed(2));
  const label = labels[unit]?.[lang] || unit;
  return `${rounded} ${label}`;
}
