import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use separate threads with limited concurrency to manage memory better
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      },
    },
    // Isolate tests better
    isolate: true,
    // Increase timeout for slower test execution
    testTimeout: 30000,
  },
});
