/// <reference types="vitest/globals" />
import { setIframeSrc } from './embed';

describe('setIframeSrc', () => {
  it('replaces the iframe location instead of pushing history', () => {
    const replace = vi.fn();
    const iframe = { contentWindow: { location: { replace } }, src: 'about:blank' } as unknown as HTMLIFrameElement;
    setIframeSrc(iframe, 'https://example.com/');
    expect(replace).toHaveBeenCalledWith('https://example.com/');
    expect(iframe.src).toBe('about:blank');
  });

  it('falls back to setting src when the iframe has no window', () => {
    const iframe = { contentWindow: null, src: 'about:blank' } as unknown as HTMLIFrameElement;
    setIframeSrc(iframe, 'https://example.com/');
    expect(iframe.src).toBe('https://example.com/');
  });

  it('falls back to setting src when replace throws', () => {
    const replace = vi.fn(() => { throw new Error('blocked'); });
    const iframe = { contentWindow: { location: { replace } }, src: 'about:blank' } as unknown as HTMLIFrameElement;
    setIframeSrc(iframe, 'https://example.com/');
    expect(iframe.src).toBe('https://example.com/');
  });
});
