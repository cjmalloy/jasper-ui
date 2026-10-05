import { describe, expect, it, vi } from 'vitest';
import { setIframeSrc } from './embed';

function mockIframe(replace = vi.fn()) {
  return {
    src: 'about:blank',
    isConnected: true,
    contentWindow: { location: { replace } },
  } as unknown as HTMLIFrameElement;
}

describe('setIframeSrc', () => {
  it('should use src for the first navigation', () => {
    const replace = vi.fn();
    const iframe = mockIframe(replace);
    setIframeSrc(iframe, 'https://example.com/a');
    expect(iframe.src).toBe('https://example.com/a');
    expect(replace).not.toHaveBeenCalled();
  });

  it('should use location.replace for later navigations', () => {
    const replace = vi.fn();
    const iframe = mockIframe(replace);
    setIframeSrc(iframe, 'https://example.com/a');
    setIframeSrc(iframe, 'https://example.com/b');
    expect(replace).toHaveBeenCalledWith('https://example.com/b');
    expect(iframe.src).toBe('https://example.com/a');
  });

  it('should fall back to src when replace throws', () => {
    const replace = vi.fn(() => { throw new Error(); });
    const iframe = mockIframe(replace);
    setIframeSrc(iframe, 'https://example.com/a');
    setIframeSrc(iframe, 'https://example.com/b');
    expect(iframe.src).toBe('https://example.com/b');
  });

  it('should fall back to src when disconnected', () => {
    const replace = vi.fn();
    const iframe = mockIframe(replace);
    setIframeSrc(iframe, 'https://example.com/a');
    (iframe as any).isConnected = false;
    setIframeSrc(iframe, 'https://example.com/b');
    expect(replace).not.toHaveBeenCalled();
    expect(iframe.src).toBe('https://example.com/b');
  });
});
