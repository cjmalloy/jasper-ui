import type { Map } from 'maplibre-gl';

const cancel = (e: DragEvent) => e.preventDefault();

/**
 * Stop a text selection covering the map from being dragged as text,
 * which would take over the mouse and stop the map from panning.
 */
export function preventSelectionDrag(map: Map) {
  map.getCanvasContainer().addEventListener('dragstart', cancel);
}
