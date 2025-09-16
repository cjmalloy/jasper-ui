# Jasper-UI Development Guide

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build

- Install Node.js 22 (required for Cypress and full compatibility):
  - `wget https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz`
  - `tar -xf node-v22.19.0-linux-x64.tar.xz && sudo cp -r node-v22.19.0-linux-x64/* /usr/local/`
  - Alternative: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`
- Install dependencies:
  - `npm ci` -- takes 12-15 seconds. Use `CYPRESS_INSTALL_BINARY=0 npm ci` if network blocks Cypress downloads.
- Build the application:
  - `npm run build` -- takes 90-120 seconds. NEVER CANCEL. Set timeout to 180+ seconds.
  - Build output stored in `dist/jasper-ui/` with localized versions in `en/` and `ja/` subdirectories
  - Build warnings about budget limits and CommonJS dependencies are normal and expected
- Run unit tests:
  - `npm test -- --watch=false --browsers=ChromeHeadless` -- takes 45-60 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
  - 185+ tests should pass. Warning errors during test execution are expected and don't affect test success.
- Development server:
  - `npm start` -- initial build takes 50-60 seconds, then serves on http://localhost:4200/
  - Auto-reloads on file changes

### E2E Testing

- Cypress tests require Docker and full backend stack:
  - `npm run cy:ci` -- full Docker-based e2e tests. Takes 10-20 minutes. NEVER CANCEL. Set timeout to 30+ minutes.
  - `npm run cy:open` -- interactive Cypress testing with Docker backend
  - Tests run against http://localhost:8080 with backend on http://localhost:8081

### Additional Scripts and Utilities

- Extract localization: `ng extract-i18n --output-path src/locale`
- Generate new components: `ng generate component component-name`
- Debug IP configuration: `./set-debug-ip.sh` (requires `jq` and `sponge` packages)

## Validation

- ALWAYS manually test any UI changes by running the development server and exercising the affected functionality
- Test complete user scenarios:
  - Start the dev server: `npm start`
  - Navigate to http://localhost:4200/ 
  - Test basic navigation, content creation, and user interactions
  - The app loads with a dark theme and "Jasper" branding
  - Without backend, expect API connection errors (normal for frontend-only testing)
- ALWAYS run unit tests before completing changes: `npm test -- --watch=false --browsers=ChromeHeadless`
- For major changes, run full e2e tests: `npm run cy:ci` (requires network access for Docker images)

## Build Limitations

- Docker builds fail in restricted network environments due to certificate issues with npm registry
- Cypress installation fails without internet access to download.cypress.io
- Node.js 20 works for basic development but Node.js 22 required for full Cypress compatibility
- Some packages show engine warnings with Node.js versions below 22

## Project Structure

### Key Directories

- `src/app/` - Main Angular application code
  - `src/app/mods/` - Modular features and plugins (80+ mod files)
  - `src/app/component/` - Reusable UI components
  - `src/app/page/` - Page-level components
  - `src/app/service/` - Angular services for API and data management
  - `src/app/store/` - State management with MobX
- `cypress/` - E2E test suite with Docker configuration
- `src/assets/` - Static assets and configuration
- `dist/` - Build output (generated)

### Important Files

- `angular.json` - Angular CLI configuration with build and serve settings
- `package.json` - Dependencies and npm scripts
- `src/assets/config.json` - Runtime configuration (API endpoints, features)
- `karma.conf.js` / `karma-ci.conf.js` - Unit test configuration
- `cypress.config.ts` - E2E test configuration
- `set-debug-ip.sh` - Development utility for IP configuration

### Configuration Points

- API backend URL configured in `src/assets/config.json` (default: port 8081)
- Content Security Policy configured in `angular.json` serve options
- Localization files in `src/locale/` (English and Japanese)
- Themes and styling in `src/theme/` and `src/styles.scss`

## Common Tasks

### Development Workflow

1. Make code changes
2. Test in development server: `npm start`
3. Run unit tests: `npm test -- --watch=false --browsers=ChromeHeadless`
4. Build and verify: `npm run build`
5. For UI changes, manually test complete user workflows

### Adding New Features

- Use Angular schematics: `ng generate component|service|pipe|directive name`
- Follow existing patterns in `src/app/mods/` for plugin-style features
- Update localization files if adding user-facing text
- Add unit tests following existing `.spec.ts` patterns

### Troubleshooting

- Build errors: Check Node.js version (22 recommended), clean `node_modules` and reinstall
- Test failures: Ensure Chrome/Chromium available for headless testing
- Network issues: Use `CYPRESS_INSTALL_BINARY=0` flag for npm install
- API connection errors in browser: Expected without running backend (port 8081)

## Architecture Notes

- Angular 20 application with TypeScript
- MobX for state management (not NgRx)
- Modular plugin architecture in `mods/` directory
- Internationalization with Angular i18n (English/Japanese)
- Service Worker for PWA functionality
- Monaco Editor integration for code editing features
- D3.js for data visualization components
- Cypress for comprehensive E2E testing with Docker backend