import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use separate threads with limited concurrency to manage memory better
    pool: 'threads',
    // Isolate tests better
    isolate: true,
    // Increase timeout to 30s for slower test execution due to limited concurrency
    testTimeout: 30000,
  },
});
