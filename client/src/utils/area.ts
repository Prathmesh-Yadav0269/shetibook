export type AreaUnit = 'acre' | 'guntha' | 'hectare';

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

export function toSquareMeters(value: number, unit: AreaUnit): number {
  if (value <= 0 || !Number.isFinite(value)) {
    return 0;
  }

  switch (unit) {
    case 'hectare':
      return value * SQM_PER_HECTARE;
    case 'acre':
      return value * SQM_PER_ACRE;
    case 'guntha':
      return value * SQM_PER_GUNTHA;
    default:
      return 0;
  }
}

export function fromSquareMeters(sqm: number, targetUnit: AreaUnit): number {
  if (sqm <= 0 || !Number.isFinite(sqm)) {
    return 0;
  }

  switch (targetUnit) {
    case 'hectare':
      return sqm / SQM_PER_HECTARE;
    case 'acre':
      return sqm / SQM_PER_ACRE;
    case 'guntha':
      return sqm / SQM_PER_GUNTHA;
    default:
      return 0;
  }
}

export function calculateAreaBreakdown(value: number, unit: AreaUnit): AreaBreakdown {
  if (value <= 0 || !Number.isFinite(value)) {
    return { sqm: 0, acre: 0, guntha: 0, hectare: 0 };
  }
  const sqm = toSquareMeters(value, unit);
  return {
    sqm: Number(sqm.toFixed(2)),
    acre: Number(fromSquareMeters(sqm, 'acre').toFixed(2)),
    guntha: Number(fromSquareMeters(sqm, 'guntha').toFixed(2)),
    hectare: Number(fromSquareMeters(sqm, 'hectare').toFixed(4)),
  };
}

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
