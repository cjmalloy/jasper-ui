/**
 * Memoization Decorator (@memo)
 *
 * This file implements the @memo decorator, used for memoizing expensive computations in
 * class getters and methods that accept a single string argument. It is particularly effective
 * in Angular applications where getters are used in templates for readability but can lead to
 * performance issues due to repeated evaluations during Angular's change detection cycles.
 *
 * Primary Use:
 * - Ideal for getters in Angular components that are referenced in templates and perform calculations.
 * - Using @memo on such getters caches the result, reducing the performance overhead
 *   of Angular's change detection.
 * - Best suited for getters with computational logic, rather than simple property access.
 *
 * Quick Start:
 * - Apply @memo to a class getter or a method that takes a single string argument.
 * - For getters, @memo caches the result of the first call and returns this cached value on subsequent calls.
 * - For methods, @memo caches results based on the string argument value.
 *
 * Example Usage:
 * class MyClass {
 *   @memo
 *   get expensiveComputation() {
 *     // Expensive calculation or logic here
 *   }
 *
 *   @memo
 *   computeSomething(arg: string) {
 *     // Function logic here
 *   }
 * }
 *
 * Caveats:
 * - @memo is only suitable for getters and methods with a single string argument.
 * - It's not designed for async functions or methods with multiple or non-string arguments.
 * - Cached values persist for the lifetime of the class instance, unless explicitly cleared.
 * - Use MemoCache.clear(instance) to clear cached values for a specific class instance.
 *
 * This implementation aims to provide a simple and effective way to optimize performance
 * by avoiding unnecessary recalculations, especially in data-intensive or CPU-heavy applications.
 */
export function memo(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  if (descriptor.get) {
    // Handle as a getter
    return memoizeGetter(descriptor, propertyKey);
  } else if (descriptor.value && typeof descriptor.value === 'function') {
    // Handle as a function with a single string argument
    descriptor.value = memoizeFunction(descriptor.value, propertyKey);
  } else {
    console.warn(`@Memo is applied to '${propertyKey}', which is neither a getter nor a suitable function.`);
  }
  return descriptor;
}

function memoizeGetter(descriptor: PropertyDescriptor, propertyKey: string) {
  const originalMethod = descriptor.get!;
  const cacheKey = Symbol.for(`__cache__${propertyKey}`);

  descriptor.get = function () {
    const classCache = MemoCache.getCache(this);
    if (!(cacheKey in classCache)) {
      classCache[cacheKey] = originalMethod.apply(this);
    }
    return classCache[cacheKey];
  };
}

function memoizeFunction<T extends Object>(originalFunction: (this: T, arg: string) => any, propertyKey: string) {
  return function(this: T, arg: string) {
    const cacheKey = Symbol.for(`__cache__${propertyKey}_${arg}`);
    const classCache = MemoCache.getCache(this);

    if (!(cacheKey in classCache)) {
      classCache[cacheKey] = originalFunction.call(this, arg);
    }
    return classCache[cacheKey];
  }
}

export class MemoCache {
  private static cacheMap = new WeakMap<Object, any>();

  public static getCache(instance: Object) {
    if (!this.cacheMap.has(instance)) {
      this.cacheMap.set(instance, {});
    }
    return this.cacheMap.get(instance);
  }

  public static clear(instance: Object, propertyKey?: string, arg?: string) {
    if (this.cacheMap.has(instance)) {
      if (arg) {
        delete this.cacheMap.get(instance)[Symbol.for(`__cache__${propertyKey}_${arg}`)];
      } else if (propertyKey) {
        delete this.cacheMap.get(instance)[Symbol.for(`__cache__${propertyKey}`)];
      } else {
        this.cacheMap.set(instance, {});
      }
    }
  }
}
