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
 * There is no reliable keyboard API, so this requires a focused text field and a
 * viewport that shrank (`interactive-widget=resizes-content`) compared to the
 * tallest height seen at the current width. Once open, the state is kept until
 * the viewport recovers, so moving focus to a button does not move it mid-tap.
 */
export function trackAndroidKeyboard() {
  if (!document.body.classList.contains('android')) return () => {};
  const maxHeight = new Map<number, number>();
  // Lowest height at widths first seen with the keyboard open (e.g. after rotating)
  const openHeight = new Map<number, number>();
  let open = false;
  const update = (focused: EventTarget | null = document.activeElement) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (open && !maxHeight.has(width)) {
      // The closed-keyboard height at this width is unknown, so stay open until it grows
      const low = Math.min(openHeight.get(width) ?? height, height);
      openHeight.set(width, low);
      if (height - low < KEYBOARD_MIN_HEIGHT) return;
    }
    const max = Math.max(maxHeight.get(width) || 0, height);
    maxHeight.set(width, max);
    open = max - height >= KEYBOARD_MIN_HEIGHT && (open || opensKeyboard(focused));
    if (!open) openHeight.clear();
    document.body.classList.toggle('keyboard-open', open);
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
