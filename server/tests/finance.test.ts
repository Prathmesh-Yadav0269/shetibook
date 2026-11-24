import { describe, it, expect } from 'vitest';
import {
  toPaise,
  fromPaise,
  formatCurrency,
  derivePaymentStatus,
  toKg,
  fromKg,
  convertHarvestQuantity,
  formatQuantity,
} from '../src/utils/finance.js';

describe('Finance Utilities Unit Tests', () => {
  describe('Currency & Paise Handling', () => {
    it('converts rupees to positive integer paise without precision loss', () => {
      expect(toPaise(100)).toBe(10000);
      expect(toPaise(1250.50)).toBe(125050);
      expect(toPaise('3450.75')).toBe(345075);
      expect(toPaise(0.01)).toBe(1);
      expect(toPaise(0)).toBe(0);
    });

    it('rejects invalid or negative amounts in toPaise', () => {
      expect(() => toPaise(-50)).toThrow('रक्कम वैध व सकारात्मक असावी');
      expect(() => toPaise('abc')).toThrow('रक्कम वैध व सकारात्मक असावी');
    });

    it('converts paise to rupees correctly', () => {
      expect(fromPaise(10000)).toBe(100);
      expect(fromPaise(125050)).toBe(1250.50);
      expect(fromPaise(1)).toBe(0.01);
      expect(fromPaise(0)).toBe(0);
    });

    it('formats currency with Marathi and English locale and ₹ symbol', () => {
      const formattedEn = formatCurrency(125050, 'en');
      expect(formattedEn).toContain('₹');
      expect(formattedEn).toContain('1,250.50');

      const formattedMr = formatCurrency(500000, 'mr');
      expect(formattedMr).toContain('₹');
      expect(formattedMr.length).toBeGreaterThan(2);
    });

    it('correctly derives payment status', () => {
      expect(derivePaymentStatus(10000, 0)).toBe('unpaid');
      expect(derivePaymentStatus(10000, 5000)).toBe('partial');
      expect(derivePaymentStatus(10000, 10000)).toBe('paid');
      expect(derivePaymentStatus(10000, 12000)).toBe('paid');
    });
  });

  describe('Agricultural Harvest Units & Conversions', () => {
    it('converts all units to kilograms accurately', () => {
      expect(toKg(10, 'kg')).toBe(10);
      expect(toKg(5, 'quintal')).toBe(500);
      expect(toKg(2.5, 'tonne')).toBe(2500);
    });

    it('converts kilograms to target units accurately', () => {
      expect(fromKg(500, 'quintal')).toBe(5);
      expect(fromKg(2500, 'tonne')).toBe(2.5);
      expect(fromKg(75, 'kg')).toBe(75);
    });

    it('converts directly between different harvest units', () => {
      // 10 quintals = 1 tonne
      expect(convertHarvestQuantity(10, 'quintal', 'tonne')).toBe(1);
      // 2 tonnes = 20 quintals
      expect(convertHarvestQuantity(2, 'tonne', 'quintal')).toBe(20);
      // 150 kg = 1.5 quintal
      expect(convertHarvestQuantity(150, 'kg', 'quintal')).toBe(1.5);
    });

    it('formats quantity with Marathi and English localized labels', () => {
      expect(formatQuantity(5, 'quintal', 'mr')).toBe('5 क्विंटल');
      expect(formatQuantity(5, 'quintal', 'en')).toBe('5 quintal');
      expect(formatQuantity(100, 'kg', 'mr')).toBe('100 किलो');
      expect(formatQuantity(2.5, 'tonne', 'en')).toBe('2.5 tonne');
    });
  });
});
