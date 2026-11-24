/**
 * Minimum drop in viewport height, in px, that counts as the on-screen keyboard.
 * Larger than a collapsing browser toolbar, smaller than any phone keyboard.
 */
export const KEYBOARD_MIN_HEIGHT = 150;

const NO_KEYBOARD_INPUTS = ['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'];

export function opensKeyboard(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) return !el.readOnly && !NO_KEYBOARD_INPUTS.includes(el.type);
  return el instanceof HTMLElement && !!el.isContentEditable;
}

/**
 * Toggles `keyboard-open` on the body while the Android on-screen keyboard is open.
 * There is no reliable keyboard API, so this requires both a focused text field
 * and a viewport that shrank (`interactive-widget=resizes-content`) compared to
 * the tallest height seen at the current width.
 */
export function trackAndroidKeyboard() {
  if (!document.body.classList.contains('android')) return () => {};
  const maxHeight = new Map<number, number>();
  const update = (focused: EventTarget | null = document.activeElement) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const max = Math.max(maxHeight.get(width) || 0, height);
    maxHeight.set(width, max);
    document.body.classList.toggle('keyboard-open', opensKeyboard(focused) && max - height >= KEYBOARD_MIN_HEIGHT);
  };
  const resize = () => update();
  const focusin = (event: FocusEvent) => update(event.target);
  const focusout = (event: FocusEvent) => update(event.relatedTarget);
  update();
  window.addEventListener('resize', resize);
  document.addEventListener('focusin', focusin);
  document.addEventListener('focusout', focusout);
  return () => {
    window.removeEventListener('resize', resize);
    document.removeEventListener('focusin', focusin);
    document.removeEventListener('focusout', focusout);
    document.body.classList.remove('keyboard-open');
  };
}
