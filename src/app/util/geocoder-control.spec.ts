/// <reference types="vitest/globals" />
import { GeocoderControl } from './geocoder-control';

describe('GeocoderControl', () => {
  it('overlays results and flies to the selected one', async () => {
    const search = vi.fn().mockResolvedValue([{ name: 'Halifax', location: [-63.57, 44.65] }]);
    const map = { flyTo: vi.fn(), getZoom: () => 6 } as any;
    const control = new GeocoderControl(search);
    const el = control.onAdd(map);
    const input = el.querySelector('.geocoder-input') as HTMLInputElement;
    input.value = 'Halifax';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await vi.waitFor(() => expect(el.querySelector('.geocoder-result')).toBeTruthy());
    expect(search).toHaveBeenCalledWith('Halifax', expect.any(AbortSignal));
    (el.querySelector('.geocoder-result') as HTMLButtonElement).click();
    expect(map.flyTo).toHaveBeenCalledWith({ center: [-63.57, 44.65], zoom: 14 });
    expect(el.querySelector('.geocoder-result')).toBeNull();
    control.onRemove();
  });

  it('shows when nothing is found', async () => {
    const control = new GeocoderControl(vi.fn().mockResolvedValue([]));
    const el = control.onAdd({} as any);
    const input = el.querySelector('.geocoder-input') as HTMLInputElement;
    input.value = 'nowhere';
    (el.querySelector('.geocoder-button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(el.querySelector('.geocoder-status')?.textContent).toBe('No results found.'));
  });
});
