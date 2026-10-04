import { addGeoLayers, BlinkClock } from './geo-style';

describe('geo-style', () => {
  function mockMap() {
    const map: any = {
      layers: [] as any[],
      images: {} as Record<string, any>,
      resolver: undefined as Function | null | undefined,
      setMissingStyleImageResolver: vi.fn((fn: Function | null) => map.resolver = fn),
      addLayer: vi.fn((layer: any) => map.layers.push(layer)),
      triggerRepaint: vi.fn(),
      hasImage: vi.fn((id: string) => !!map.images[id]),
      addImage: vi.fn((id: string, image: any) => map.images[id] = image),
    };
    return map;
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('adds layers for each style', () => {
    const map = mockMap();
    const remove = addGeoLayers(map, 'src', 'test', 5);
    expect(map.layers.map((l: any) => l.id)).toEqual([
      'test-fill',
      'test-fill-pattern',
      'test-lines',
      'test-lines-dashed',
      'test-lines-blink',
      'test-points',
      'test-points-blink',
    ]);
    expect(map.layers.every((l: any) => l.source === 'src')).toBe(true);
    remove();
  });

  it('draws blinking styles with pattern images', () => {
    const map = mockMap();
    const remove = addGeoLayers(map, 'src', 'test', 5);
    const layer = (id: string) => map.layers.find((l: any) => l.id === id);
    expect(JSON.stringify(layer('test-fill-pattern').paint['fill-pattern'])).toContain('blink-fill');
    expect(JSON.stringify(layer('test-lines-blink').paint['line-pattern'])).toContain('blink-line');
    expect(layer('test-points-blink').type).toBe('symbol');
    expect(JSON.stringify(layer('test-points-blink').layout['icon-image'])).toContain('blink-point');
    remove();
    expect(map.resolver).toBeNull();
  });

  it('repaints once at the next blink phase until disposed', () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    const map = mockMap();
    const clock = new BlinkClock(map);
    expect(clock.on).toBe(true);
    clock.drawn();
    clock.drawn();
    vi.advanceTimersByTime(399);
    expect(map.triggerRepaint).not.toHaveBeenCalled();
    now.mockReturnValue(501);
    vi.advanceTimersByTime(2);
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
    expect(clock.on).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
    clock.drawn();
    clock.dispose();
    vi.advanceTimersByTime(2000);
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
  });

  it('ignores missing images from other layers', () => {
    const map = mockMap();
    const remove = addGeoLayers(map, 'src', 'test', 5);
    map.resolver('other');
    map.resolver('geo-pattern-unknown|rgba(0,0,0,1)');
    expect(map.addImage).not.toHaveBeenCalled();
    remove();
  });
});
