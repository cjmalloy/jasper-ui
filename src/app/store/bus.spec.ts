/// <reference types="vitest/globals" />
import { Ref } from '../model/ref';
import { EventBus } from './bus';

describe('EventBus', () => {
  const ref = { url: 'https://example.com', origin: '' } as Ref;

  it('publishes events synchronously', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.events.subscribe(listener);

    bus.fire('test', ref);

    expect(listener).toHaveBeenCalledWith({
      event: 'test',
      ref,
      repost: undefined,
      errors: [],
    });
  });

  it('does not replay events to new subscribers', () => {
    const bus = new EventBus();
    const listener = vi.fn();

    bus.fire('test', ref);
    bus.events.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it('publishes errors without mutating the provided array', () => {
    const bus = new EventBus();
    const errors = ['Failed'];
    let event;
    bus.events.subscribe(value => event = value);

    bus.fireError(errors, ref);
    errors.push('Changed');

    expect(event).toEqual({
      event: 'error',
      ref,
      repost: undefined,
      errors: ['Failed'],
    });
  });

  it('tracks progress with immutable signal updates', () => {
    const bus = new EventBus();

    bus.clearProgress(2);
    bus.msg('Starting');
    bus.progress('Done');
    bus.steps();

    expect(bus.progressMessages).toEqual(['Starting', 'Done']);
    expect(bus.progressNum).toBe(1);
    expect(bus.progressDen).toBe(3);
  });
});
