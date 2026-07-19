/// <reference types="vitest/globals" />
import { autorun } from 'mobx';

import { EventBus } from './bus';

describe('EventBus', () => {
  it('signals repeated events without resetting the event', () => {
    const bus = new EventBus();
    const events: string[] = [];
    const dispose = autorun(() => {
      const event = bus.event;
      if (event) events.push(event);
    });

    bus.fire('refresh');
    bus.fire('refresh');

    expect(events).toEqual(['refresh', 'refresh']);
    expect(bus.event).toBe('refresh');
    dispose();
  });
});
