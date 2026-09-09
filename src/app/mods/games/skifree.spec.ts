/// <reference types="vitest/globals" />
import { validate } from 'jtd';
import { scorePlugin } from './score';
import { skiFreeMod, skiFreePlugin, skiFreeTemplate } from './skifree';

interface SkiResult {
  mode: string;
  distance: number;
  time: number;
  missed: number;
  final: boolean;
}

describe('SkiFree mod', () => {
  let root: HTMLDivElement;
  let callback: FrameRequestCallback | undefined;
  let now: number;
  let destroy: () => void;
  let save: ReturnType<typeof vi.fn>;
  let app: (root: HTMLElement, api: { writable?: boolean; initial?: object; score?: unknown; save?: typeof save }) => () => void;

  const element = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`.skifree-${name}`)!;
  const key = (value: string, type = 'keydown') => root.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }));
  const advance = (seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) {
      now += 100;
      callback?.(now);
    }
  };
  const start = (mode = 'free') => {
    element<HTMLSelectElement>('course').value = mode;
    element('start').click();
    advance(.2);
  };

  beforeEach(() => {
    now = 100;
    save = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const context = Object.fromEntries([
      'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'closePath', 'fill', 'ellipse',
      'save', 'restore', 'translate', 'rotate',
    ].map(name => [name, () => {}]));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { callback = fn; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { callback = undefined; }));
    root = document.createElement('div');
    root.innerHTML = skiFreePlugin.config!.ui!;
    root = root.firstElementChild as HTMLDivElement;
    document.body.appendChild(root);
    const canvas = element<HTMLCanvasElement>('canvas');
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => false);
    canvas.releasePointerCapture = vi.fn();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 720, height: 600 } as DOMRect);
    const source = skiFreePlugin.config!.snippet!.replace(/<\/?script>/g, '');
    app = new Function('Handlebars', source + '; return skiFreeApp;')({ registerHelper: vi.fn() });
    destroy = app(root, { save });
  });

  afterEach(() => {
    destroy();
    root.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is a self-contained plugin/template bundle with score sorting', () => {
    expect(skiFreeMod.plugin).toEqual([scorePlugin, skiFreePlugin]);
    expect(skiFreeMod.template).toEqual([skiFreeTemplate]);
    expect(skiFreeTemplate.defaults.defaultSort[0]).toBe('plugins->plugin/score:num,DESC');
    expect(validate(skiFreePlugin.schema!, skiFreePlugin.defaults)).toEqual([]);
  });

  it('starts only on request and pauses without advancing the run', () => {
    advance(5);
    expect(root.dataset.state).toBe('ready');
    expect(root.dataset.distance).toBe('0');
    start();
    advance(3);
    expect(Number(root.dataset.distance)).toBeGreaterThan(80);
    key('p');
    const distance = root.dataset.distance;
    const time = element('time').textContent;
    advance(5);
    expect(root.dataset.state).toBe('paused');
    expect(root.dataset.distance).toBe(distance);
    expect(element('time').textContent).toBe(time);
    key('p');
    advance(1);
    expect(root.dataset.state).toBe('skiing');
    expect(Number(root.dataset.distance)).toBeGreaterThan(Number(distance));
  });

  it('supports steering, braking, jumps, tricks and fast mode', () => {
    start();
    advance(2);
    key(' ');
    key('ArrowRight');
    advance(.7);
    key('ArrowRight', 'keyup');
    key('ArrowDown');
    advance(.5);
    key('ArrowDown', 'keyup');
    expect(element('score').textContent).not.toBe('Score: 0');
    key('f');
    expect(root.dataset.fast).toBe('true');
    advance(3);
    expect(Number(element('speed').textContent!.match(/\d+/)![0])).toBeGreaterThan(250);
    key('ArrowUp');
    advance(2);
    expect(element('speed').textContent).toBe('Speed: 0 km/h');
    key('ArrowUp', 'keyup');
  });

  it('recovers from obstacle collisions instead of ending the run', () => {
    vi.mocked(Math.random).mockReturnValue(.5);
    destroy = app(root, { save });
    start();
    advance(3);
    expect(element('speed').textContent).toBe('Speed: 0 km/h');
    const distance = Number(root.dataset.distance);
    advance(3);
    expect(Number(root.dataset.distance)).toBeGreaterThan(distance);
    expect(root.dataset.state).toBe('skiing');
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a schema-valid slalom result with missed-gate penalties and can continue', () => {
    start('slalom');
    advance(30);
    expect(root.dataset.state).toBe('course-complete');
    expect(element('message').textContent).toBe('Course complete!');
    expect(save).toHaveBeenCalledTimes(1);
    const result = save.mock.calls[0][0] as SkiResult;
    expect(validate(skiFreePlugin.schema!, result)).toEqual([]);
    expect(result.distance).toBe(1000);
    expect(result.missed).toBeGreaterThan(0);
    expect(result.time).toBeCloseTo(20 + result.missed * 5, 0);
    expect(result.final).toBe(false);
    element('start').click();
    advance(1);
    expect(root.dataset.state).toBe('skiing');
    expect(Number(root.dataset.distance)).toBeGreaterThan(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('finishes the freestyle course and retains jump points', () => {
    start('freestyle');
    advance(1);
    key(' ');
    advance(30);
    expect(root.dataset.state).toBe('course-complete');
    expect(save.mock.calls[0][0].mode).toBe('freestyle');
    expect(save.mock.calls[0][1]).toBeGreaterThan(0);
  });

  it('spawns the yeti after 2,000 m and saves the caught result once', () => {
    start();
    advance(42);
    expect(element('status').textContent).toContain('Yeti!');
    advance(15);
    expect(root.dataset.state).toBe('over');
    expect(element('message').textContent).toBe('The yeti caught you!');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].distance).toBeGreaterThanOrEqual(2000);
    expect(save.mock.calls[0][0].final).toBe(true);
    advance(5);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('allows escaping the yeti using the classic F fast mode', () => {
    start();
    key('f');
    advance(80);
    expect(Number(root.dataset.distance)).toBeGreaterThan(5000);
    expect(root.dataset.state).toBe('skiing');
    expect(element('status').textContent).toContain('Yeti!');
    expect(save).not.toHaveBeenCalled();
  });

  it('shows saved results safely and lets read-only examples play without writing', () => {
    destroy = app(root, { writable: false, initial: { final: true, distance: 123, time: 10, mode: 'free' }, score: 250, save });
    expect(element('result').textContent).toContain('Score: 250');
    expect(element('example').hidden).toBe(false);
    start();
    advance(2);
    key('End');
    expect(root.dataset.state).toBe('over');
    expect(save).not.toHaveBeenCalled();
    expect(element('result').textContent).toContain('Distance:');
  });

  it('saves on finish and starts a clean new game without immediately overwriting the saved result', () => {
    start();
    advance(2);
    key(' ');
    advance(1);
    key('End');
    expect(save).toHaveBeenCalledTimes(1);
    const result = save.mock.calls[0][0];
    expect(validate(skiFreePlugin.schema!, result)).toEqual([]);
    expect(result.final).toBe(true);
    expect(save.mock.calls[0][1]).toBeGreaterThan(0);
    expect(validate(scorePlugin.schema!, save.mock.calls[0][1])).toEqual([]);
    element('start').click();
    expect(root.dataset.distance).toBe('0');
    expect(element('score').textContent).toBe('Score: 0');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('pauses on focus loss and cleans up detached instances', () => {
    start();
    window.dispatchEvent(new Event('blur'));
    expect(root.dataset.state).toBe('paused');
    element('start').click();
    advance(1);
    root.remove();
    advance(.1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(callback).toBeUndefined();
    key('f');
    expect(root.dataset.fast).toBe('false');
  });

  it('chases the pointer, stops at its destination, and scrolls when led downhill', () => {
    start();
    const canvas = element('canvas');
    const move = (y: number) => {
      const event = new MouseEvent('pointermove', { clientX: 360, clientY: y });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      canvas.dispatchEvent(event);
    };
    move(250);
    advance(5);
    const distance = Number(root.dataset.distance);
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(30);
    advance(3);
    expect(Number(root.dataset.distance)).toBeLessThanOrEqual(distance + 1);
    move(580);
    advance(5);
    expect(Number(root.dataset.distance)).toBeGreaterThan(distance + 100);
    expect(root.querySelector('.skifree-touch-controls')).toBeNull();
    expect(root.querySelector('.skifree-toolbar')).toBeNull();
  });

  it('jumps on a touch/pointer press and keeps chasing the target after release', () => {
    start();
    const canvas = element('canvas');
    const event = new MouseEvent('pointerdown', { clientX: 360, clientY: 250, button: 0, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'touch' } });
    canvas.dispatchEvent(event);
    canvas.dispatchEvent(new Event('pointerup'));
    canvas.dispatchEvent(new Event('lostpointercapture'));
    const leave = new Event('pointerleave');
    Object.defineProperty(leave, 'pointerType', { value: 'touch' });
    canvas.dispatchEvent(leave);
    advance(2);
    expect(element('score').textContent).not.toBe('Score: 0');
    expect(Number(root.dataset.distance)).toBeGreaterThan(10);
    expect(Number(root.dataset.distance)).toBeLessThan(30);
    expect(element('speed').textContent).toBe('Speed: 0 km/h');
    const distance = root.dataset.distance;
    advance(3);
    expect(root.dataset.distance).toBe(distance);
  });

  it('normalizes malformed saved values rather than rendering markup or NaN', () => {
    destroy = app(root, { initial: { final: true, distance: Infinity, time: -1, mode: 'unknown' }, score: '<img src=x>', save });
    expect(element('result').textContent).toContain('Time: 0.0 s');
    expect(element('result').textContent).toContain('Score: 0');
    expect(element('result').querySelector('img')).toBeNull();
    expect(element<HTMLSelectElement>('course').value).toBe('free');
  });
});
