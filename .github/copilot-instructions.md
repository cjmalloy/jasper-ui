# Jasper-UI Development Guide

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Quick Start

- **CRITICAL**: Debugging this client requires the Jasper server backend to be running
- Use the automated setup: `./setup-dev.sh` or `make setup`
- For full development with backend: `make start-backend` then `make start` (in separate terminal)

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

### Development Server Options

**Option 1: Frontend Only (Limited Functionality)**
- `npm start` -- initial build takes 50-60 seconds, then serves on http://localhost:4200/
- Auto-reloads on file changes
- Expect API connection errors (normal without backend)

**Option 2: Full Stack Development (Recommended)**
- `npm run start:backend` -- starts Jasper server and database via Docker
- `npm start` -- in separate terminal, starts frontend on http://localhost:4200/
- Backend API available on http://localhost:8081/
- Full functionality including authentication, data persistence, etc.

**Option 3: Complete Dockerized Stack**
- `npm run start:full --profile with-ui` -- everything in Docker on http://localhost:8080/

### Testing and CI/CD Integration

- Run tests like GitHub Actions:
  - `npm run test:docker` -- unit tests in Docker (matches CI exactly)
  - `npm run cy:ci` -- full E2E tests with backend. Takes 10-20 minutes. NEVER CANCEL. Set timeout to 30+ minutes.
- Build Docker image: `npm run build:docker`
- Stop all services: `npm run stop:full` or `make stop`

### Additional Scripts and Utilities

- Extract localization: `ng extract-i18n --output-path src/locale`
- Generate new components: `ng generate component component-name`
- Debug IP configuration: `./set-debug-ip.sh` (requires `jq` and `sponge` packages)
- Quick commands: `make help` for full list of available commands

## Validation

- **CRITICAL**: Always test with the backend running for meaningful validation
- Recommended validation workflow:
  1. Start backend: `make start-backend` 
  2. Start frontend: `make start` (in new terminal)
  3. Navigate to http://localhost:4200/
  4. Test complete user scenarios: login, content creation, navigation
  5. Run unit tests: `npm test -- --watch=false --browsers=ChromeHeadless`
  6. For major changes, run e2e tests: `npm run cy:ci`

- Frontend-only testing (limited):
  - The app loads with a dark theme and "Jasper" branding
  - Expect API connection errors (normal without backend)
  - Only useful for UI layout and styling validation

## Build Limitations and Network Issues

- Docker builds may fail in restricted network environments due to certificate issues with npm registry
- Cypress installation fails without internet access to download.cypress.io
- Use `CYPRESS_INSTALL_BINARY=0 npm ci` to skip Cypress downloads when needed
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
- `quickstart/` - Simple Docker compose for end users
- `docker-compose.dev.yaml` - Development Docker setup

### Important Files

- `angular.json` - Angular CLI configuration with build and serve settings
- `package.json` - Dependencies and npm scripts (enhanced with development commands)
- `src/assets/config.json` - Runtime configuration (title, features) - DO NOT edit API URL here
- `karma.conf.js` / `karma-ci.conf.js` - Unit test configuration
- `cypress.config.ts` - E2E test configuration
- `set-debug-ip.sh` - Development utility for IP configuration
- `setup-dev.sh` - Automated development environment setup
- `Makefile` - Simple command shortcuts for common tasks

### Configuration Points

- API backend URL configured via Docker environment `JASPER_API` (default: localhost:8081 for development)
- Frontend connects to backend via CSP settings in `angular.json` serve configuration  
- Content Security Policy configured in `angular.json` serve options
- Localization files in `src/locale/` (English and Japanese)
- Themes and styling in `src/theme/` and `src/styles.scss`
- Docker development stack in `docker-compose.dev.yaml`

## Common Tasks

### Development Workflow

1. Set up environment: `./setup-dev.sh` or `make setup`
2. Start backend: `make start-backend` (wait for health check)
3. Start frontend: `make start` (in new terminal)
4. Make code changes (auto-reload enabled)
5. Test changes: `make test`
6. Build verification: `make build`
7. For UI changes, manually test complete user workflows with backend

### Adding New Features

- Use Angular schematics: `ng generate component|service|pipe|directive name`
- Follow existing patterns in `src/app/mods/` for plugin-style features
- Update localization files if adding user-facing text
- Add unit tests following existing `.spec.ts` patterns
- Test with backend running to validate API interactions
- **DO NOT** edit `src/assets/config.json` for API configuration - use Docker environment variables

### Troubleshooting

- Build errors: Check Node.js version (22 recommended), clean `node_modules` and reinstall
- Test failures: Ensure Chrome/Chromium available for headless testing
- Network issues: Use `CYPRESS_INSTALL_BINARY=0` flag for npm install
- Backend connection issues: Ensure `make start-backend` is running and healthy
- Docker issues: `make clean` to reset Docker state

## Architecture Notes

- Angular 20 application with TypeScript
- MobX for state management (not NgRx)
- Modular plugin architecture in `mods/` directory
- Internationalization with Angular i18n (English/Japanese)
- Service Worker for PWA functionality
- Monaco Editor integration for code editing features
- D3.js for data visualization components
- Cypress for comprehensive E2E testing with Docker backend
- Full-stack development supported via Docker containers