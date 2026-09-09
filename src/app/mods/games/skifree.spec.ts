/// <reference types="vitest/globals" />
import { validate } from 'jtd';
import { skiFreeMod, skiFreePlugin, skiFreeTemplate } from './skifree';

interface SkiResult {
  mode: string;
  distance: number;
  time: number;
  missed: number;
  score: number;
  final: boolean;
}

describe('SkiFree mod', () => {
  let root: HTMLDivElement;
  let callback: FrameRequestCallback | undefined;
  let now: number;
  let destroy: () => void;
  let save: ReturnType<typeof vi.fn>;
  let app: (root: HTMLElement, api: { writable?: boolean; initial?: object; save?: typeof save }) => () => void;

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
    expect(skiFreeMod.plugin).toEqual([skiFreePlugin]);
    expect(skiFreeMod.template).toEqual([skiFreeTemplate]);
    expect(skiFreeTemplate.defaults.defaultSort[0]).toBe('plugins->plugin/skifree->score:num,DESC');
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
    element('pause').click();
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
    expect(element('fast').getAttribute('aria-pressed')).toBe('true');
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
    expect(result.time).toBeGreaterThan(20 + result.missed * 5);
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
    expect(save.mock.calls[0][0].score).toBeGreaterThan(0);
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
    destroy = app(root, { writable: false, initial: { final: true, distance: 123, score: 250, time: 10, mode: 'free' }, save });
    expect(element('result').textContent).toContain('Score: 250');
    expect(element('example').hidden).toBe(false);
    start();
    advance(2);
    element('finish').click();
    expect(root.dataset.state).toBe('over');
    expect(save).not.toHaveBeenCalled();
    expect(element('result').textContent).toContain('Distance:');
  });

  it('saves on finish and starts a clean new game without immediately overwriting the saved result', () => {
    start();
    advance(2);
    key(' ');
    advance(1);
    element('finish').click();
    expect(save).toHaveBeenCalledTimes(1);
    const result = save.mock.calls[0][0];
    expect(validate(skiFreePlugin.schema!, result)).toEqual([]);
    expect(result.final).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    element('start').click();
    expect(root.dataset.distance).toBe('0');
    expect(element('score').textContent).toBe('Score: 0');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('pauses on focus loss, cleans up detached instances, and isolates simultaneous games', () => {
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
    expect(element('fast').getAttribute('aria-pressed')).toBe('false');
  });

  it('normalizes malformed saved values rather than rendering markup or NaN', () => {
    destroy = app(root, { initial: { final: true, distance: Infinity, time: -1, score: '<img src=x>', mode: 'unknown' }, save });
    expect(element('result').textContent).toContain('Time: 0.0 s');
    expect(element('result').textContent).toContain('Score: 0');
    expect(element('result').querySelector('img')).toBeNull();
    expect(element<HTMLSelectElement>('course').value).toBe('free');
  });
});
