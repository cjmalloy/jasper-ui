/// <reference types="vitest/globals" />
import { Point, Rect, relativeX, relativeY } from './math';

describe('Math Utils', () => {
  describe('Rect.contains', () => {
    it('should return true when point is inside rectangle', () => {
      const rect: Rect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const point: Point = { x: 5, y: 5 };
      expect(Rect.contains(rect, point)).toBe(true);
    });

    it('should return true when point is on rectangle edge', () => {
      const rect: Rect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const point: Point = { x: 0, y: 5 };
      expect(Rect.contains(rect, point)).toBe(true);
    });

    it('should return true when point is on rectangle corner', () => {
      const rect: Rect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const point: Point = { x: 0, y: 0 };
      expect(Rect.contains(rect, point)).toBe(true);
    });

    it('should return false when point is outside rectangle', () => {
      const rect: Rect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const point: Point = { x: 15, y: 5 };
      expect(Rect.contains(rect, point)).toBe(false);
    });

    it('should return false when rect is undefined', () => {
      const point: Point = { x: 5, y: 5 };
      expect(Rect.contains(undefined, point)).toBe(false);
    });

    it('should return false when point is undefined', () => {
      const rect: Rect = { x1: 0, y1: 0, x2: 10, y2: 10 };
      expect(Rect.contains(rect, undefined)).toBe(false);
    });

    it('should return false when both are undefined', () => {
      expect(Rect.contains(undefined, undefined)).toBe(false);
    });

    it('should handle inverted rectangle coordinates (x1 > x2)', () => {
      const rect: Rect = { x1: 10, y1: 0, x2: 0, y2: 10 };
      const point: Point = { x: 5, y: 5 };
      expect(Rect.contains(rect, point)).toBe(true);
    });

    it('should handle inverted rectangle coordinates (y1 > y2)', () => {
      const rect: Rect = { x1: 0, y1: 10, x2: 10, y2: 0 };
      const point: Point = { x: 5, y: 5 };
      expect(Rect.contains(rect, point)).toBe(true);
    });

    it('should handle fully inverted rectangle', () => {
      const rect: Rect = { x1: 10, y1: 10, x2: 0, y2: 0 };
      const point: Point = { x: 5, y: 5 };
      expect(Rect.contains(rect, point)).toBe(true);
    });
  });

  describe('relativeX', () => {
    it('should add scrollX when element is not provided', () => {
      // Mock scrollX  
      const originalScrollX = globalThis.scrollX;
      Object.defineProperty(globalThis, 'scrollX', { value: 100, writable: true });
      
      const result = relativeX(50);
      expect(result).toBe(150);
      
      Object.defineProperty(globalThis, 'scrollX', { value: originalScrollX, writable: true });
    });
  });

  describe('relativeY', () => {
    it('should add scrollY when element is not provided', () => {
      // Mock scrollY
      const originalScrollY = globalThis.scrollY;
      Object.defineProperty(globalThis, 'scrollY', { value: 100, writable: true });
      
      const result = relativeY(50);
      expect(result).toBe(150);
      
      Object.defineProperty(globalThis, 'scrollY', { value: originalScrollY, writable: true });
    });
  });
});
