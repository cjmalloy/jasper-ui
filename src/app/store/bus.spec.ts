/// <reference types="vitest/globals" />
import { Ref } from '../model/ref';
import { EventBus } from './bus';

describe('EventBus', () => {
  const ref = { url: 'https://example.com', origin: '' } as Ref;

  it('publishes and resets events', () => {
    const bus = new EventBus();

    bus.fire('test', ref);

    expect(bus.event).toBe('test');
    expect(bus.ref).toBe(ref);
    expect(bus.repost).toBeUndefined();

    bus.reset();

    expect(bus.event).toBe('');
    expect(bus.ref).toBeUndefined();
  });

  it('tracks errors without mutating the provided array', () => {
    const bus = new EventBus();
    const errors = ['Failed'];

    bus.fireError(errors, ref);
    errors.push('Changed');

    expect(bus.event).toBe('error');
    expect(bus.errors).toEqual(['Failed']);
    expect(bus.ref).toBe(ref);
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
