import { describe, it, expect } from 'vitest';
import {
  toSquareMeters,
  fromSquareMeters,
  convertArea,
  calculateAreaBreakdown,
  formatArea,
  SQM_PER_ACRE,
  SQM_PER_HECTARE,
  SQM_PER_GUNTHA,
} from '../src/utils/area.js';

describe('ShetiBook Phase 2 - Land Area Management & Conversion Tests', () => {
  it('1. Exact conversions between Acre, Guntha and Square Metres', () => {
    // 1 acre = 40 guntha
    expect(convertArea(1, 'acre', 'guntha')).toBeCloseTo(40, 5);
    expect(convertArea(2, 'acre', 'guntha')).toBeCloseTo(80, 5);
    expect(convertArea(0.5, 'acre', 'guntha')).toBeCloseTo(20, 5);

    // 1 guntha = 0.025 acre
    expect(convertArea(1, 'guntha', 'acre')).toBeCloseTo(0.025, 5);
    expect(convertArea(40, 'guntha', 'acre')).toBeCloseTo(1, 5);
    expect(convertArea(10, 'guntha', 'acre')).toBeCloseTo(0.25, 5);

    // 1 acre in square metres
    expect(toSquareMeters(1, 'acre')).toBeCloseTo(SQM_PER_ACRE, 5);
    expect(toSquareMeters(1, 'guntha')).toBeCloseTo(SQM_PER_GUNTHA, 5);
    expect(toSquareMeters(1, 'hectare')).toBeCloseTo(SQM_PER_HECTARE, 5);
  });

  it('2. Exact conversions involving Hectares', () => {
    // 1 hectare = 2.4710538147 acres
    expect(convertArea(1, 'hectare', 'acre')).toBeCloseTo(2.4710538, 4);
    // 1 hectare = 10000 sqm
    expect(toSquareMeters(1, 'hectare')).toBe(10000);
    // From sqm to hectare
    expect(fromSquareMeters(10000, 'hectare')).toBe(1);
    expect(fromSquareMeters(5000, 'hectare')).toBe(0.5);
  });

  it('3. Complete area breakdown calculates all equivalent units', () => {
    const breakdown = calculateAreaBreakdown(2, 'acre');
    expect(breakdown.acre).toBe(2);
    expect(breakdown.guntha).toBe(80);
    expect(breakdown.hectare).toBeCloseTo(0.8094, 3);
    expect(breakdown.sqm).toBeCloseTo(8093.71, 1);
  });

  it('4. Formats localized Marathi and English labels', () => {
    expect(formatArea(2.5, 'acre', 'mr')).toBe('2.5 एकर');
    expect(formatArea(2.5, 'acre', 'en')).toBe('2.5 Acre');

    expect(formatArea(15, 'guntha', 'mr')).toBe('15 गुंठे');
    expect(formatArea(15, 'guntha', 'en')).toBe('15 Guntha');

    expect(formatArea(1.234, 'hectare', 'mr')).toBe('1.234 हेक्टर');
    expect(formatArea(1.234, 'hectare', 'en')).toBe('1.234 Hectare');
  });

  it('5. Rejects zero, negative, or invalid values', () => {
    expect(() => toSquareMeters(0, 'acre')).toThrow('Area must be a positive finite number.');
    expect(() => toSquareMeters(-5, 'guntha')).toThrow('Area must be a positive finite number.');
    expect(() => toSquareMeters(NaN, 'hectare')).toThrow('Area must be a positive finite number.');
    expect(() => fromSquareMeters(-100, 'acre')).toThrow('Square meters must be non-negative finite number.');
  });
});
