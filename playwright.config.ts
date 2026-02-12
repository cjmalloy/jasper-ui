import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [
      ['list'],
      ['html', { outputFolder: 'e2e/reports/html', open: 'never' }],
      ['json', { outputFile: 'e2e/reports/results.json' }],
    ] : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    // baseURL: 'http://localhost:4200', // debugging
    trace: 'on-first-retry',
    video: process.env.CI ? 'on' : 'off',
    viewport: { width: 1280, height: 720 }, // Prevent mobile layout
    actionTimeout: 10_000,
  },
});
