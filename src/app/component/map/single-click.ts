import type { Map, MapMouseEvent } from 'maplibre-gl';

/**
 * Time to wait for a second click before handling a click on the map.
 */
export const DOUBLE_CLICK_DELAY = 300;

export interface SingleClickOptions {
  delay?: number;
  /**
   * Called right away on a click, so it can be shown before it is handled.
   */
  preview?: (e: MapMouseEvent) => void;
  /**
   * Called when a previewed click turns out to be part of a double click.
   */
  cancel?: () => void;
}

/**
 * Handle clicks on the map that are not part of a double click, so double
 * clicking still zooms in. Returns a function to remove the handler.
 */
export function onSingleClick(map: Map, handler: (e: MapMouseEvent) => void, options: SingleClickOptions = {}): () => void {
  const delay = options.delay ?? DOUBLE_CLICK_DELAY;
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const clear = () => {
    pending.forEach(clearTimeout);
    pending.clear();
  };
  const cancel = () => {
    const previewed = pending.size > 0;
    clear();
    if (previewed) options.cancel?.();
  };
  const click = (e: MapMouseEvent) => {
    if (isRepeatClick(e.originalEvent)) {
      cancel();
      return;
    }
    options.preview?.(e);
    const timer = setTimeout(() => {
      pending.delete(timer);
      handler(e);
    }, delay);
    pending.add(timer);
  };
  map.on('click', click);
  map.on('dblclick', cancel);
  return () => {
    clear();
    map.off('click', click);
    map.off('dblclick', cancel);
  };
}

/**
 * The second or later click of a double click.
 */
export function isRepeatClick(e?: Event) {
  return !!e && 'detail' in e && e.type === 'click' && (e as MouseEvent).detail > 1;
}
