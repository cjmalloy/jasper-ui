import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['html', { outputFolder: 'e2e/reports/html', open: 'never' }], ['json', { outputFile: 'e2e/reports/results.json' }]]
    : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    video: process.env.CI ? 'on' : 'off',
    viewport: { width: 1025, height: 768 }, // Prevent mobile layout
    actionTimeout: 10_000,
  },
});
