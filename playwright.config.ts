import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  shard: process.env.PW_SHARD ? {
    current: +process.env.PW_SHARD.split('/')[0],
    total: +process.env.PW_SHARD.split('/')[1],
  } : undefined,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [
      ['list'],
      ...(process.env.PW_SHARD ? [
        ['blob', { outputDir: 'e2e/reports/blob', fileName: `report-${process.env.PW_SHARD.replace('/', '-')}.zip` }],
      ] as const : [
        ['html', { outputFolder: 'e2e/reports/html', open: 'never' }],
        ['json', { outputFile: 'e2e/reports/results.json' }],
      ] as const),
    ] : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    // baseURL: 'http://localhost:4200', // debugging
    trace: 'on-first-retry',
    // PW_VIDEO=on records every test (master), anything else keeps only failures (PRs)
    video: !process.env.CI ? 'off' : process.env.PW_VIDEO === 'on' ? 'on' : 'retain-on-failure',
    viewport: { width: 1280, height: 720 }, // Prevent mobile layout
    actionTimeout: 10_000,
  },
});
