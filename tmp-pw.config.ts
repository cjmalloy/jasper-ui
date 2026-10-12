import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '/home/runner/work/jasper-ui/jasper-ui/e2e', workers: 1, use: { baseURL: 'http://localhost:8080' } });
