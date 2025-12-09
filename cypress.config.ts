import { defineConfig } from 'cypress'
import * as fs from 'fs';
import * as path from 'path';

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
    defaultCommandTimeout: 10_000,
    numTestsKeptInMemory: 0,
    setupNodeEvents(on, config) {
      require('cypress-mochawesome-reporter/plugin')(on);
      
      // Task to find a downloaded file
      on('task', {
        findDownloadedFile({ folder, pattern, exclude }: { folder: string, pattern: string, exclude?: string }) {
          try {
            const files = fs.readdirSync(folder);
            const matchingFiles = files.filter(file => {
              if (exclude && file === exclude) return false;
              if (pattern === '*.zip') return file.endsWith('.zip');
              return file.includes(pattern);
            });
            return matchingFiles.length > 0 ? matchingFiles[0] : null;
          } catch (e) {
            return null;
          }
        },
        
        // Task to delete all downloads
        deleteDownloads(folder: string) {
          try {
            const files = fs.readdirSync(folder);
            files.forEach(file => {
              fs.unlinkSync(path.join(folder, file));
            });
            return true;
          } catch (e) {
            return false;
          }
        }
      });
    },
  },
})
