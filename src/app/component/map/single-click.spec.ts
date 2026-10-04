import { onSingleClick } from './single-click';

describe('onSingleClick', () => {
  let listeners: Record<string, ((e?: any) => void)[]>;
  let map: any;

  const click = (detail: number) => listeners['click'].forEach(l => l({ originalEvent: new MouseEvent('click', { detail }) }));

  beforeEach(() => {
    vi.useFakeTimers();
    listeners = {};
    map = {
      on: (type: string, l: any) => (listeners[type] ||= []).push(l),
      off: (type: string, l: any) => listeners[type] = listeners[type].filter(x => x !== l),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles a single click after the double click delay', () => {
    const handler = vi.fn();
    onSingleClick(map, handler);
    click(1);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores double clicks', () => {
    const handler = vi.fn();
    onSingleClick(map, handler);
    click(1);
    click(2);
    listeners['dblclick'].forEach(l => l());
    vi.advanceTimersByTime(300);
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles separate clicks', () => {
    const handler = vi.fn();
    onSingleClick(map, handler);
    click(1);
    click(1);
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('cancels pending clicks when removed', () => {
    const handler = vi.fn();
    const remove = onSingleClick(map, handler);
    click(1);
    remove();
    vi.advanceTimersByTime(300);
    expect(handler).not.toHaveBeenCalled();
    expect(listeners['click']).toHaveLength(0);
  });

  it('previews clicks and cancels the preview on a double click', () => {
    const handler = vi.fn();
    const preview = vi.fn();
    const cancel = vi.fn();
    onSingleClick(map, handler, { preview, cancel });
    click(1);
    expect(preview).toHaveBeenCalledTimes(1);
    click(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    listeners['dblclick'].forEach(l => l());
    expect(cancel).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not cancel the preview when removed', () => {
    const cancel = vi.fn();
    const remove = onSingleClick(map, vi.fn(), { cancel });
    click(1);
    remove();
    expect(cancel).not.toHaveBeenCalled();
  });
});
