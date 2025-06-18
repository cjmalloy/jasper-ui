/**
 * Memoization Decorator (@memo)
 *
 * This file implements the @memo decorator, used for memoizing expensive computations in
 * class getters and methods. It supports methods with multiple arguments and varargs.
 * It is particularly effective in Angular applications where getters are used in templates
 * for readability but can lead to performance issues due to repeated evaluations during
 * Angular's change detection cycles.
 *
 * Primary Use:
 * - Ideal for getters in Angular components that are referenced in templates and perform calculations.
 * - Using @memo on such getters/methods caches the result, reducing the performance overhead
 *   of Angular's change detection.
 * - Best suited for getters with computational logic, rather than simple property access.
 *
 * Quick Start:
 * - Apply @memo to a class getter or method.
 * - For getters, @memo caches the result of the first call and returns this cached value on subsequent calls.
 * - For methods, @memo caches results based on all argument values.
 *
 * Example Usage:
 * class MyClass {
 *   @memo
 *   get expensiveComputation() {
 *     // Expensive calculation or logic here
 *   }
 *
 *   @memo
 *   computeSomething(arg1: string, arg2: number) {
 *     // Function logic here
 *   }
 *
 *   @memo
 *   computeWithVarargs(...args: any[]) {
 *     // Function logic with variable arguments
 *   }
 * }
 *
 * Caveats:
 * - Not designed for async functions (consider using a specialized async memoization decorator).
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
    // Handle as a function with any number of arguments
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

function memoizeFunction<T extends Object>(originalFunction: Function, propertyKey: string) {
  return function(this: T, ...args: any[]) {
    const cacheKey = MemoCache.generateCacheKey(propertyKey, args);
    const classCache = MemoCache.getCache(this);

    if (!(cacheKey in classCache)) {
      classCache[cacheKey] = originalFunction.apply(this, args);
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

  /**
   * Generates a unique cache key based on the property name and arguments.
   * Handles various argument types including primitives, objects, arrays, etc.
   */
  public static generateCacheKey(propertyKey: string, args: any[]): symbol {
    if (args.length === 0) {
      return Symbol.for(`__cache__${propertyKey}`);
    }

    // Create a string representation of arguments for the cache key
    const argKey = args.map(arg => {
      // Handle different types of arguments
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        // For objects and arrays, use JSON.stringify with a replacer
        // to handle circular references
        try {
          return JSON.stringify(arg, this.getCircularReplacer());
        } catch (e) {
          // Fallback to using object reference if stringify fails
          return `object_${arg.constructor.name}_${Object.keys(arg).length}`;
        }
      }
      // For primitives, use their string representation
      return String(arg);
    }).join('_');

    return Symbol.for(`__cache__${propertyKey}_${argKey}`);
  }

  /**
   * Helper function to handle circular references in JSON.stringify
   */
  private static getCircularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  /**
   * Clear cached values
   * @param instance - The class instance
   * @param propertyKey - Optional: specific method/getter name
   * @param args - Optional: specific arguments array to clear a specific cached result
   */
  public static clear(instance: Object, propertyKey?: string, args?: any[]) {
    if (this.cacheMap.has(instance)) {
      if (args && propertyKey) {
        // Clear specific cached result for given arguments
        const cacheKey = this.generateCacheKey(propertyKey, args);
        delete this.cacheMap.get(instance)[cacheKey];
      } else if (propertyKey) {
        // Clear all cached results for a specific method/getter
        const cache = this.cacheMap.get(instance);
        const prefix = `__cache__${propertyKey}`;

        // Remove all keys that start with the prefix
        Object.getOwnPropertySymbols(cache).forEach(symbol => {
          if (Symbol.keyFor(symbol)?.startsWith(prefix)) {
            delete cache[symbol];
          }
        });
      } else {
        // Clear all cached values for the instance
        this.cacheMap.set(instance, {});
      }
    }
  }
}
