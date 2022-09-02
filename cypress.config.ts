import { defineConfig } from 'cypress'

export default defineConfig({
  viewportWidth: 1025, // Prevent mobile layout
  e2e: {
    'baseUrl': 'http://localhost:4200',
    supportFile: false
  },
})
