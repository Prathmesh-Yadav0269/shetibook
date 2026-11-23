export type AreaUnit = 'acre' | 'guntha' | 'hectare';

// Exact Conversion Factors
export const SQM_PER_HECTARE = 10000;
export const SQM_PER_ACRE = 4046.8564224;
export const SQM_PER_GUNTHA = 4046.8564224 / 40; // 101.17141056
export const GUNTHA_PER_ACRE = 40;
export const ACRES_PER_HECTARE = 2.4710538147;

export interface AreaBreakdown {
  acre: number;
  guntha: number;
  hectare: number;
  sqm: number;
}

/**
 * Normalizes any supported area value and unit to square meters (sqm)
 */
export function toSquareMeters(value: number, unit: AreaUnit): number {
  if (value <= 0 || !Number.isFinite(value)) {
    throw new Error('Area must be a positive finite number.');
  }

  switch (unit) {
    case 'hectare':
      return value * SQM_PER_HECTARE;
    case 'acre':
      return value * SQM_PER_ACRE;
    case 'guntha':
      return value * SQM_PER_GUNTHA;
    default:
      throw new Error(`Unsupported area unit: ${unit}`);
  }
}

/**
 * Converts square meters to target area unit
 */
export function fromSquareMeters(sqm: number, targetUnit: AreaUnit): number {
  if (sqm < 0 || !Number.isFinite(sqm)) {
    throw new Error('Square meters must be non-negative finite number.');
  }

  switch (targetUnit) {
    case 'hectare':
      return sqm / SQM_PER_HECTARE;
    case 'acre':
      return sqm / SQM_PER_ACRE;
    case 'guntha':
      return sqm / SQM_PER_GUNTHA;
    default:
      throw new Error(`Unsupported area unit: ${targetUnit}`);
  }
}

/**
 * Converts directly between any two area units
 */
export function convertArea(value: number, fromUnit: AreaUnit, toUnit: AreaUnit): number {
  if (fromUnit === toUnit) return value;
  const sqm = toSquareMeters(value, fromUnit);
  return fromSquareMeters(sqm, toUnit);
}

/**
 * Calculates complete breakdown in all supported units
 */
export function calculateAreaBreakdown(value: number, unit: AreaUnit): AreaBreakdown {
  const sqm = toSquareMeters(value, unit);
  return {
    sqm: Number(sqm.toFixed(2)),
    acre: Number(fromSquareMeters(sqm, 'acre').toFixed(2)),
    guntha: Number(fromSquareMeters(sqm, 'guntha').toFixed(2)),
    hectare: Number(fromSquareMeters(sqm, 'hectare').toFixed(4)),
  };
}

/**
 * Format area for display with Marathi and English localized labels
 */
export function formatArea(value: number, unit: AreaUnit, lang: 'mr' | 'en' = 'mr'): string {
  const rounded = unit === 'hectare' ? value.toFixed(3) : value.toFixed(2);
  const clean = parseFloat(rounded).toString();

  const labels: Record<AreaUnit, { mr: string; en: string }> = {
    acre: { mr: 'एकर', en: 'Acre' },
    guntha: { mr: 'गुंठे', en: 'Guntha' },
    hectare: { mr: 'हेक्टर', en: 'Hectare' },
  };

  const label = labels[unit]?.[lang] || unit;
  return `${clean} ${label}`;
}
