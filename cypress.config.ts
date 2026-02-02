import { defineConfig } from 'cypress'

export default defineConfig({
  viewportWidth: 1025, // Prevent mobile layout
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    saveJson: true,
  },
  e2e: {
    // baseUrl: 'http://localhost:4200', // Use debugger with `npm run cy:open`
    baseUrl: 'http://localhost:8080',
    experimentalRunAllSpecs: true,
    experimentalMemoryManagement: true,
    defaultCommandTimeout: 10_000,
    numTestsKeptInMemory: 0,
    setupNodeEvents(on, config) {
      require('cypress-mochawesome-reporter/plugin')(on);
      
      // Configure Electron with increased memory limits
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' || browser.name === 'electron') {
          launchOptions.args.push('--disable-dev-shm-usage');
          launchOptions.args.push('--js-flags=--max-old-space-size=4096');
        }
        
        return launchOptions;
      });
    },
  },
})
