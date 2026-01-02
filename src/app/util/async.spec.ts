/// <reference types="vitest/globals" />
import { firstValueFrom } from 'rxjs';
import { delay, readFileAsDataURL, readFileAsString } from './async';

describe('Async Utils', () => {
  describe('delay', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });

    it('should resolve immediately for 0ms', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('readFileAsDataURL', () => {
    it('should read blob as data URL', async () => {
      const content = 'Hello, World!';
      const blob = new Blob([content], { type: 'text/plain' });
      
      const result = await firstValueFrom(readFileAsDataURL(blob));
      
      expect(result).toMatch(/^data:text\/plain;base64,/);
    });

    it('should read image blob as data URL', async () => {
      // Create a simple PNG blob (1x1 transparent pixel)
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      const blob = new Blob([pngData], { type: 'image/png' });
      
      const result = await firstValueFrom(readFileAsDataURL(blob));
      
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle empty blob', async () => {
      const blob = new Blob([], { type: 'text/plain' });
      
      const result = await firstValueFrom(readFileAsDataURL(blob));
      
      expect(result).toMatch(/^data:/);
    });
  });

  describe('readFileAsString', () => {
    it('should read blob as string', async () => {
      const content = 'Hello, World!';
      const blob = new Blob([content], { type: 'text/plain' });
      
      const result = await firstValueFrom(readFileAsString(blob));
      
      expect(result).toBe(content);
    });

    it('should read multi-line text', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const blob = new Blob([content], { type: 'text/plain' });
      
      const result = await firstValueFrom(readFileAsString(blob));
      
      expect(result).toBe(content);
    });

    it('should read UTF-8 content', async () => {
      const content = 'Hello, 世界! 🌍';
      const blob = new Blob([content], { type: 'text/plain' });
      
      const result = await firstValueFrom(readFileAsString(blob));
      
      expect(result).toBe(content);
    });

    it('should handle empty blob', async () => {
      const blob = new Blob([], { type: 'text/plain' });
      
      const result = await firstValueFrom(readFileAsString(blob));
      
      expect(result).toBe('');
    });

    it('should read JSON content', async () => {
      const content = '{"key": "value", "number": 42}';
      const blob = new Blob([content], { type: 'application/json' });
      
      const result = await firstValueFrom(readFileAsString(blob));
      
      expect(result).toBe(content);
      expect(JSON.parse(result)).toEqual({ key: 'value', number: 42 });
    });
  });
});
