import type { Map, MapMouseEvent } from 'maplibre-gl';

/**
 * Time to wait for a second click before handling a click on the map.
 */
export const DOUBLE_CLICK_DELAY = 300;

/**
 * Handle clicks on the map that are not part of a double click, so double
 * clicking still zooms in. Returns a function to remove the handler.
 */
export function onSingleClick(map: Map, handler: (e: MapMouseEvent) => void, delay = DOUBLE_CLICK_DELAY): () => void {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const cancel = () => {
    pending.forEach(clearTimeout);
    pending.clear();
  };
  const click = (e: MapMouseEvent) => {
    if (isRepeatClick(e.originalEvent)) {
      cancel();
      return;
    }
    const timer = setTimeout(() => {
      pending.delete(timer);
      handler(e);
    }, delay);
    pending.add(timer);
  };
  map.on('click', click);
  map.on('dblclick', cancel);
  return () => {
    cancel();
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
