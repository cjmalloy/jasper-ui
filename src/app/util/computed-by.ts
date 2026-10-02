import { computed, Signal } from '@angular/core';

export function computedBy<T>(fn: (arg: string) => T): (arg: string) => T {
  const cache = new Map<string, Signal<T>>();
  return (arg: string) => {
    let value = cache.get(arg);
    if (!value) {
      value = computed(() => fn(arg));
      cache.set(arg, value);
    }
    return value();
  };
}
