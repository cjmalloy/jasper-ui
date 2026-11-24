/// <reference types="vitest/globals" />
import { KEYBOARD_MIN_HEIGHT, opensKeyboard, trackAndroidKeyboard } from './virtual-keyboard';

describe('virtual keyboard', () => {
  let height: number;
  let stop: (() => void) | undefined;
  let input: HTMLInputElement;
  let checkbox: HTMLInputElement;

  const resize = (h: number) => {
    height = h;
    window.dispatchEvent(new Event('resize'));
  };
  const open = () => document.body.classList.contains('keyboard-open');

  beforeEach(() => {
    stop = undefined;
    height = 800;
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => height });
    input = document.createElement('input');
    checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.append(input, checkbox);
  });

  afterEach(() => {
    stop?.();
    input.remove();
    checkbox.remove();
    document.body.classList.remove('android');
  });

  it('should only treat text fields as opening the keyboard', () => {
    expect(opensKeyboard(input)).toBe(true);
    expect(opensKeyboard(checkbox)).toBe(false);
    expect(opensKeyboard(document.createElement('textarea'))).toBe(true);
    expect(opensKeyboard(document.createElement('button'))).toBe(false);
    expect(opensKeyboard(null)).toBe(false);
  });

  it('should detect the keyboard on Android when a text field is focused and the viewport shrinks', () => {
    document.body.classList.add('android');
    stop = trackAndroidKeyboard();
    input.focus();
    expect(open()).toBe(false);
    resize(800 - KEYBOARD_MIN_HEIGHT - 100);
    expect(open()).toBe(true);
    resize(800);
    expect(open()).toBe(false);
  });

  it('should ignore a small resize such as a collapsing toolbar', () => {
    document.body.classList.add('android');
    stop = trackAndroidKeyboard();
    input.focus();
    resize(800 - 56);
    expect(open()).toBe(false);
  });

  it('should ignore a shrunk viewport without a focused text field', () => {
    document.body.classList.add('android');
    stop = trackAndroidKeyboard();
    checkbox.focus();
    resize(400);
    expect(open()).toBe(false);
    input.focus();
    expect(open()).toBe(true);
    input.blur();
    expect(open()).toBe(false);
  });

  it('should do nothing outside Android', () => {
    stop = trackAndroidKeyboard();
    input.focus();
    resize(400);
    expect(open()).toBe(false);
  });
});
