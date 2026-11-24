/// <reference types="vitest/globals" />
import { exitPseudoFullscreen, pseudoFullscreenElement, requestFullscreen } from './fullscreen';

describe('requestFullscreen without the Fullscreen API', () => {
  let el: HTMLElement;
  beforeEach(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    el = document.createElement('div');
    document.body.append(el);
  });
  afterEach(() => {
    exitPseudoFullscreen();
    el.remove();
    delete (document as any).fullscreenEnabled;
  });

  it('covers the window until closed', async () => {
    await requestFullscreen(el);
    expect(pseudoFullscreenElement()).toBe(el);
    expect(el.classList).toContain('pseudo-fullscreen');
    const close = document.querySelector<HTMLButtonElement>('.pseudo-fullscreen-close')!;
    expect(close).toBeTruthy();
    const change = vi.fn();
    document.addEventListener('fullscreenchange', change);
    close.click();
    document.removeEventListener('fullscreenchange', change);
    expect(pseudoFullscreenElement()).toBeUndefined();
    expect(el.classList).not.toContain('pseudo-fullscreen');
    expect(document.querySelector('.pseudo-fullscreen-close')).toBeNull();
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    await requestFullscreen(el);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(pseudoFullscreenElement()).toBeUndefined();
  });
});
