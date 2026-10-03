import { addGeoLayers } from './geo-style';

describe('geo-style', () => {
  function mockMap() {
    const map: any = {
      layers: [] as any[],
      images: {} as Record<string, any>,
      resolver: undefined as Function | null | undefined,
      setMissingStyleImageResolver: vi.fn((fn: Function | null) => map.resolver = fn),
      addLayer: vi.fn((layer: any) => map.layers.push(layer)),
      setPaintProperty: vi.fn(),
      hasImage: vi.fn((id: string) => !!map.images[id]),
      addImage: vi.fn((id: string, image: any) => map.images[id] = image),
    };
    return map;
  }

  afterEach(() => vi.useRealTimers());

  it('adds layers for each style', () => {
    const map = mockMap();
    const remove = addGeoLayers(map, 'src', 'test', 5);
    expect(map.layers.map((l: any) => l.id)).toEqual([
      'test-fill',
      'test-fill-pattern',
      'test-fill-blink',
      'test-lines',
      'test-lines-dashed',
      'test-lines-blink',
      'test-points',
      'test-points-blink',
    ]);
    expect(map.layers.every((l: any) => l.source === 'src')).toBe(true);
    remove();
  });

  it('blinks until removed', () => {
    vi.useFakeTimers();
    const map = mockMap();
    const remove = addGeoLayers(map, 'src', 'test', 5);
    vi.advanceTimersByTime(500);
    expect(map.setPaintProperty).toHaveBeenCalledWith('test-lines-blink', 'line-opacity', 0.2);
    vi.advanceTimersByTime(500);
    expect(map.setPaintProperty).toHaveBeenCalledWith('test-lines-blink', 'line-opacity', 1);
    remove();
    map.setPaintProperty.mockClear();
    vi.advanceTimersByTime(2000);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
    expect(map.resolver).toBeNull();
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
