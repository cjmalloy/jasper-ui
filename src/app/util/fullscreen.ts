/**
 * Fullscreen for browsers without the element Fullscreen API (ex. iPhone Safari),
 * by covering the window. Closed with the close button or Escape.
 */
let current: { el: HTMLElement, close: HTMLButtonElement, keydown: (e: KeyboardEvent) => void } | undefined;

export function pseudoFullscreenElement() {
  return current?.el;
}

/**
 * Make an element fullscreen, falling back to covering the window.
 * Exiting the fallback fires a bubbling fullscreenchange event from the element like the real API.
 */
export function requestFullscreen(el: HTMLElement): Promise<void> {
  if (document.fullscreenEnabled && el.requestFullscreen) {
    try {
      return el.requestFullscreen();
    } catch (e) {
      return Promise.reject(e);
    }
  }
  exitPseudoFullscreen();
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pseudo-fullscreen-close';
  close.title = $localize`Exit fullscreen`;
  close.setAttribute('aria-label', close.title);
  close.textContent = '✕';
  close.addEventListener('click', () => exitPseudoFullscreen());
  const keydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    exitPseudoFullscreen();
  };
  current = { el, close, keydown };
  el.classList.add('pseudo-fullscreen');
  document.body.classList.add('pseudo-fullscreen-open');
  document.body.append(close);
  // The top layer covers everything regardless of the stacking contexts around the element
  showPopover(el);
  showPopover(close);
  document.addEventListener('keydown', keydown, { capture: true });
  return Promise.resolve();
}

export function exitPseudoFullscreen() {
  if (!current) return;
  const { el, close, keydown } = current;
  current = undefined;
  document.removeEventListener('keydown', keydown, { capture: true });
  hidePopover(close);
  close.remove();
  hidePopover(el);
  el.removeAttribute('popover');
  el.classList.remove('pseudo-fullscreen');
  document.body.classList.remove('pseudo-fullscreen-open');
  el.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));
}

function showPopover(el: HTMLElement) {
  if (!el.showPopover) return;
  try {
    el.setAttribute('popover', 'manual');
    el.showPopover();
  } catch {
    el.removeAttribute('popover');
  }
}

function hidePopover(el: HTMLElement) {
  try {
    if (el.matches(':popover-open')) el.hidePopover();
  } catch { }
}
