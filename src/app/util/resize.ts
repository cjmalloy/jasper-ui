export interface ResizeStart {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export function resizeStart(el: HTMLElement, event: PointerEvent): ResizeStart {
  const rect = el.getBoundingClientRect();
  return {
    x: event.clientX,
    y: event.clientY,
    width: el.offsetWidth,
    height: el.offsetHeight,
    right: rect.right,
    bottom: rect.bottom,
  };
}

/**
 * Resize so the bottom right corner follows the pointer, even when the
 * layout moves the element as it grows (ex. centered with margin: auto).
 */
export function resizeToPointer(
  el: HTMLElement,
  start: ResizeStart,
  event: PointerEvent,
  setWidth?: (width: number) => void,
  setHeight?: (height: number) => void,
) {
  if (setWidth) track(start.width, start.right, start.right + event.clientX - start.x, setWidth, () => el.getBoundingClientRect().right);
  if (setHeight) track(start.height, start.bottom, start.bottom + event.clientY - start.y, setHeight, () => el.getBoundingClientRect().bottom);
}

function track(size0: number, edge0: number, target: number, set: (size: number) => void, measure: () => number) {
  let size = Math.max(0, size0 + target - edge0);
  set(size);
  for (let i = 0; i < 3; i++) {
    const edge = measure();
    const error = target - edge;
    if (Math.abs(error) < 0.5) return;
    // Secant step: how far the edge moved per pixel of size
    const slope = (edge - edge0) / (size - size0);
    if (!isFinite(slope) || slope < 0.1) return;
    size0 = size;
    edge0 = edge;
    size = Math.max(0, size + error / slope);
    set(size);
  }
}

const GRIP = 18;

/**
 * Replace native textarea resizing so the grip follows the pointer.
 * Returns a teardown function.
 */
export function trackTextareaResize() {
  let el: HTMLTextAreaElement | undefined;
  let start: ResizeStart | undefined;
  let setWidth: ((width: number) => void) | undefined;
  let setHeight: ((height: number) => void) | undefined;
  const down = (event: PointerEvent) => {
    if (event.button || event.pointerType === 'touch') return;
    if (!(event.target instanceof HTMLTextAreaElement)) return;
    const target = event.target;
    const style = getComputedStyle(target);
    const resize = style.resize;
    if (!resize || resize === 'none') return;
    const rect = target.getBoundingClientRect();
    if (rect.right - event.clientX > GRIP || rect.bottom - event.clientY > GRIP) return;
    event.preventDefault();
    event.stopPropagation();
    el = target;
    start = resizeStart(el, event);
    const extraWidth = start.width - parseFloat(style.width);
    const extraHeight = start.height - parseFloat(style.height);
    setWidth = resize === 'both' || resize === 'horizontal' || resize === 'inline'
      ? width => el!.style.width = Math.max(0, width - extraWidth) + 'px'
      : undefined;
    setHeight = resize === 'both' || resize === 'vertical' || resize === 'block'
      ? height => el!.style.height = Math.max(0, height - extraHeight) + 'px'
      : undefined;
    el.setPointerCapture?.(event.pointerId);
    document.body.classList.add('textarea-resizing');
  };
  const move = (event: PointerEvent) => {
    if (!el || !start) return;
    event.preventDefault();
    resizeToPointer(el, start, event, setWidth, setHeight);
  };
  const up = (event: PointerEvent) => {
    if (!el) return;
    el.releasePointerCapture?.(event.pointerId);
    el = start = setWidth = setHeight = undefined;
    document.body.classList.remove('textarea-resizing');
  };
  window.addEventListener('pointerdown', down, { capture: true });
  window.addEventListener('pointermove', move, { capture: true });
  window.addEventListener('pointerup', up, { capture: true });
  window.addEventListener('pointercancel', up, { capture: true });
  return () => {
    window.removeEventListener('pointerdown', down, { capture: true });
    window.removeEventListener('pointermove', move, { capture: true });
    window.removeEventListener('pointerup', up, { capture: true });
    window.removeEventListener('pointercancel', up, { capture: true });
  };
}
