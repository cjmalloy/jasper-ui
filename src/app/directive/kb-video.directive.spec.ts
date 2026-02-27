/// <reference types="vitest/globals" />
import { KbVideoDirective } from './kb-video.directive';

function makeDirective() {
  const video = document.createElement('video');
  Object.defineProperty(video, 'duration', { value: 100, configurable: true });
  video.volume = 0.5;
  video.currentTime = 50;
  const directive = new KbVideoDirective({ nativeElement: video } as any);
  return { directive, video };
}

function key(directive: KbVideoDirective, k: string, repeat = false) {
  // cancelable: true is required for event.preventDefault() to take effect in tests
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'repeat', { value: repeat });
  directive.onKeydown(event);
}

describe('KbVideoDirective', () => {
  it('should create an instance', () => {
    const directive = new KbVideoDirective({ nativeElement: document.createElement('video') } as any);
    expect(directive).toBeTruthy();
  });

  it('should rewind 5s on ArrowLeft', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 20;
    key(directive, 'ArrowLeft');
    expect(video.currentTime).toBe(15);
  });

  it('should not seek before 0 on ArrowLeft', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 2;
    key(directive, 'ArrowLeft');
    expect(video.currentTime).toBe(0);
  });

  it('should fast-forward 5s on ArrowRight', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 20;
    key(directive, 'ArrowRight');
    expect(video.currentTime).toBe(25);
  });

  it('should not seek past duration on ArrowRight', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 98;
    key(directive, 'ArrowRight');
    expect(video.currentTime).toBe(100);
  });

  it('should rewind 10s on J', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 30;
    key(directive, 'j');
    expect(video.currentTime).toBe(20);
  });

  it('should fast-forward 10s on L', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 30;
    key(directive, 'l');
    expect(video.currentTime).toBe(40);
  });

  it('should increase volume on ArrowUp', () => {
    const { directive, video } = makeDirective();
    video.volume = 0.5;
    key(directive, 'ArrowUp');
    expect(video.volume).toBeCloseTo(0.55);
  });

  it('should decrease volume on ArrowDown', () => {
    const { directive, video } = makeDirective();
    video.volume = 0.5;
    key(directive, 'ArrowDown');
    expect(video.volume).toBeCloseTo(0.45);
  });

  it('should toggle mute on M', () => {
    const { directive, video } = makeDirective();
    expect(video.muted).toBe(false);
    key(directive, 'm');
    expect(video.muted).toBe(true);
    key(directive, 'M');
    expect(video.muted).toBe(false);
  });

  it('should not toggle mute on repeated M keydown', () => {
    const { directive, video } = makeDirective();
    video.muted = false;
    key(directive, 'm', true);
    expect(video.muted).toBe(false);
  });

  it('should seek to start on Home', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 50;
    key(directive, 'Home');
    expect(video.currentTime).toBe(0);
  });

  it('should seek to end on End', () => {
    const { directive, video } = makeDirective();
    video.currentTime = 50;
    key(directive, 'End');
    expect(video.currentTime).toBe(100);
  });

  it('should seek by percentage on digit keys', () => {
    const { directive, video } = makeDirective();
    key(directive, '5');
    expect(video.currentTime).toBe(50);
    key(directive, '0');
    expect(video.currentTime).toBe(0);
    key(directive, '9');
    expect(video.currentTime).toBe(90);
  });

  it('should not seek when duration is NaN and no seekable range', () => {
    const { directive, video } = makeDirective();
    Object.defineProperty(video, 'duration', { value: NaN, configurable: true });
    video.currentTime = 50;
    key(directive, 'ArrowRight');
    key(directive, 'l');
    key(directive, 'End');
    key(directive, '5');
    expect(video.currentTime).toBe(50);
  });

  it('should use seekable range end when duration is Infinity (HLS/live)', () => {
    const { directive, video } = makeDirective();
    Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
    const mockSeekable = { length: 1, end: (_i: number) => 200 } as TimeRanges;
    Object.defineProperty(video, 'seekable', { value: mockSeekable, configurable: true });
    video.currentTime = 190;
    key(directive, 'ArrowRight');
    expect(video.currentTime).toBe(195);
    key(directive, 'l');
    expect(video.currentTime).toBe(200);
  });
});
