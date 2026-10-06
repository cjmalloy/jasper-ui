import type { Map } from 'maplibre-gl';
import { preventSelectionDrag } from './selection-drag';

describe('preventSelectionDrag', () => {
  it('cancels native drags started on the map', () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    preventSelectionDrag({ getCanvasContainer: () => container } as unknown as Map);
    const event = new Event('dragstart', { bubbles: true, cancelable: true });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
