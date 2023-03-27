import { defineConfig } from 'cypress'

export default defineConfig({
  viewportWidth: 1025, // Prevent mobile layout
  e2e: {
    baseUrl: 'http://localhost:4200',
    experimentalRunAllSpecs: true,
    defaultCommandTimeout: 10_000,
    setupNodeEvents(on, config) {
      require('cypress-mochawesome-reporter/plugin')(on);
    },
  },
})
