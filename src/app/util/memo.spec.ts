/// <reference types="vitest/globals" />
import { memo, MemoCache } from './memo';

describe('Memo Utils', () => {
  describe('memo decorator for getters', () => {
    it('should cache getter result', () => {
      let callCount = 0;
      
      class TestClass {
        @memo
        get expensiveValue() {
          callCount++;
          return 'computed';
        }
      }

      const instance = new TestClass();
      expect(instance.expensiveValue).toBe('computed');
      expect(instance.expensiveValue).toBe('computed');
      expect(callCount).toBe(1);
    });

    it('should cache values per instance', () => {
      let callCount = 0;
      
      class TestClass {
        constructor(private value: string) {}
        
        @memo
        get expensiveValue() {
          callCount++;
          return this.value;
        }
      }

      const instance1 = new TestClass('a');
      const instance2 = new TestClass('b');
      
      expect(instance1.expensiveValue).toBe('a');
      expect(instance2.expensiveValue).toBe('b');
      expect(callCount).toBe(2);
      
      // Cache should work per instance
      expect(instance1.expensiveValue).toBe('a');
      expect(instance2.expensiveValue).toBe('b');
      expect(callCount).toBe(2);
    });
  });

  describe('memo decorator for functions', () => {
    it('should cache function result by argument', () => {
      let callCount = 0;
      
      class TestClass {
        @memo
        compute(arg: string) {
          callCount++;
          return `result-${arg}`;
        }
      }

      const instance = new TestClass();
      expect(instance.compute('a')).toBe('result-a');
      expect(instance.compute('a')).toBe('result-a');
      expect(callCount).toBe(1);
    });

    it('should cache different arguments separately', () => {
      let callCount = 0;
      
      class TestClass {
        @memo
        compute(arg: string) {
          callCount++;
          return `result-${arg}`;
        }
      }

      const instance = new TestClass();
      expect(instance.compute('a')).toBe('result-a');
      expect(instance.compute('b')).toBe('result-b');
      expect(callCount).toBe(2);
      
      // Cached values
      expect(instance.compute('a')).toBe('result-a');
      expect(instance.compute('b')).toBe('result-b');
      expect(callCount).toBe(2);
    });
  });

  describe('MemoCache', () => {
    it('should get cache for instance', () => {
      const instance = {};
      const cache = MemoCache.getCache(instance);
      expect(cache).toBeDefined();
      expect(typeof cache).toBe('object');
    });

    it('should return same cache for same instance', () => {
      const instance = {};
      const cache1 = MemoCache.getCache(instance);
      const cache2 = MemoCache.getCache(instance);
      expect(cache1).toBe(cache2);
    });

    it('should return different caches for different instances', () => {
      const instance1 = {};
      const instance2 = {};
      const cache1 = MemoCache.getCache(instance1);
      const cache2 = MemoCache.getCache(instance2);
      expect(cache1).not.toBe(cache2);
    });

    it('should clear entire cache for instance', () => {
      let callCount = 0;
      
      class TestClass {
        @memo
        get value() {
          callCount++;
          return 'computed';
        }
      }

      const instance = new TestClass();
      expect(instance.value).toBe('computed');
      expect(callCount).toBe(1);
      
      MemoCache.clear(instance);
      expect(instance.value).toBe('computed');
      expect(callCount).toBe(2);
    });

    it('should clear specific property cache', () => {
      let valueCallCount = 0;
      let otherCallCount = 0;
      
      class TestClass {
        @memo
        get value() {
          valueCallCount++;
          return 'computed';
        }
        
        @memo
        get other() {
          otherCallCount++;
          return 'other';
        }
      }

      const instance = new TestClass();
      expect(instance.value).toBe('computed');
      expect(instance.other).toBe('other');
      expect(valueCallCount).toBe(1);
      expect(otherCallCount).toBe(1);
      
      MemoCache.clear(instance, 'value');
      expect(instance.value).toBe('computed');
      expect(instance.other).toBe('other');
      expect(valueCallCount).toBe(2);
      expect(otherCallCount).toBe(1);
    });

    it('should clear cache for function with specific argument', () => {
      let callCount = 0;
      
      class TestClass {
        @memo
        compute(arg: string) {
          callCount++;
          return `result-${arg}`;
        }
      }

      const instance = new TestClass();
      expect(instance.compute('a')).toBe('result-a');
      expect(instance.compute('b')).toBe('result-b');
      expect(callCount).toBe(2);
      
      MemoCache.clear(instance, 'compute', 'a');
      expect(instance.compute('a')).toBe('result-a');
      expect(instance.compute('b')).toBe('result-b');
      expect(callCount).toBe(3); // Only 'a' was recomputed
    });

    it('should not throw when clearing cache for instance without cache', () => {
      const instance = {};
      expect(() => MemoCache.clear(instance)).not.toThrow();
    });
  });
});
