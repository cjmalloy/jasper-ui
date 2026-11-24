import { describe, expect, it } from 'vitest';
import { isApple } from './keyboard';

const nav = (n: any) => n as Navigator;

describe('isApple', () => {
  it('detects macOS from user agent client hints', () => {
    expect(isApple(nav({ userAgentData: { platform: 'macOS' }, platform: '', userAgent: 'Electron/45' }))).toBe(true);
  });

  it('detects macOS from navigator.platform', () => {
    expect(isApple(nav({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 jasper-app Electron/45' }))).toBe(true);
  });

  it('detects macOS from the user agent', () => {
    expect(isApple(nav({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Electron/45' }))).toBe(true);
  });

  it('uses Ctrl on other platforms', () => {
    expect(isApple(nav({ userAgentData: { platform: 'Windows' }, platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Electron/45' }))).toBe(false);
    expect(isApple(nav({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }))).toBe(false);
  });
});
