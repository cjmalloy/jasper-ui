# Jasper-UI Development Guide

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Quick Start

- **CRITICAL**: Debugging this client requires the Jasper server backend to be running
- Follow the detailed bash commands below for setup and development
- For full development: start backend services first, then frontend in separate terminal

### Bootstrap and Build

- Install Node.js 22 (required for Cypress and full compatibility):
  ```bash
  wget https://nodejs.org/dist/v22.19.0/node-v22.19.0-linux-x64.tar.xz
  tar -xf node-v22.19.0-linux-x64.tar.xz && sudo cp -r node-v22.19.0-linux-x64/* /usr/local/
  ```
  - Alternative: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`

- Install dependencies:
  ```bash
  npm ci
  ```
  - Takes 12-15 seconds
  - Use `CYPRESS_INSTALL_BINARY=0 npm ci` if network blocks Cypress downloads

- Build the application:
  ```bash
  npm run build
  ```
  - Takes 90-120 seconds. NEVER CANCEL. Set timeout to 180+ seconds.
  - Build output stored in `dist/jasper-ui/` with localized versions in `en/` and `ja/` subdirectories
  - Build warnings about budget limits and CommonJS dependencies are normal and expected

- Run unit tests:
  ```bash
  npm test -- --watch=false --browsers=ChromeHeadless
  ```
  - Takes 45-60 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
  - 185+ tests should pass. Warning errors during test execution are expected and don't affect test success.

### Development Server Options

**Option 1: Frontend Only (Limited Functionality)**
```bash
npm start
```
- Initial build takes 50-60 seconds, then serves on http://localhost:4200/
- Auto-reloads on file changes
- Expect API connection errors (normal without backend)

**Option 2: Full Stack Development (Recommended)**
```bash
# Terminal 1: Start backend services
docker compose --profile server up --build

# Terminal 2: Start frontend (wait for backend to be healthy first)
npm start
```
- Backend API available on http://localhost:8081/
- Frontend on http://localhost:4200/
- Full functionality including authentication, data persistence, etc.

**Option 3: Complete Dockerized Stack**
```bash
docker compose up --build
```
- Everything in Docker on http://localhost:8082/

### Testing and CI/CD Integration

- Run tests like GitHub Actions:
  ```bash
  docker build . --target test -t jasper-ui-test && docker run --rm jasper-ui-test  # Unit tests in Docker (matches CI exactly)
  npm run cy:ci                # E2E tests with backend (10-20 min, NEVER CANCEL)
  ```
- Build Docker image:
  ```bash
  docker build . -t jasper-ui:local
  ```
- Stop all services:
  ```bash
  docker compose down
  ```

### Additional Development Commands

- Extract localization:
  ```bash
  ng extract-i18n --output-path src/locale
  ```
- Generate new components:
  ```bash
  ng generate component component-name
  ```

## Validation

- **CRITICAL**: Always test with the backend running for meaningful validation
- Recommended validation workflow:
  ```bash
  # Terminal 1: Start backend services
  docker compose --profile server up --build
  
  # Wait for backend health check, then in Terminal 2:
  npm start
  
  # Navigate to http://localhost:4200/
  # Test complete user scenarios: login, content creation, navigation
  
  # Run unit tests:
  npm test -- --watch=false --browsers=ChromeHeadless
  
  # For major changes, run e2e tests:
  npm run cy:ci
  ```

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
- `docker-compose.yaml` - Development Docker setup

### Important Files

- `angular.json` - Angular CLI configuration with build and serve settings
- `package.json` - Dependencies and npm scripts (enhanced with development commands)
- `src/assets/config.json` - Runtime configuration (title, features) - DO NOT edit API URL here
- `karma.conf.js` / `karma-ci.conf.js` - Unit test configuration
- `cypress.config.ts` - E2E test configuration

### Configuration Points

- API backend URL configured via Docker environment `JASPER_API` (default: localhost:8081 for development)
- Frontend connects to backend via CSP settings in `angular.json` serve configuration  
- Content Security Policy configured in `angular.json` serve options
- Localization files in `src/locale/` (English and Japanese)
- Themes and styling in `src/theme/` and `src/styles.scss`
- Docker development stack in `docker-compose.yaml`

## Common Tasks

### Development Workflow

1. Set up environment:
   ```bash
   # Install Node.js 22 (see above)
   npm ci
   ```

2. Start backend:
   ```bash
   docker compose --profile server up --build
   # Wait for health check to complete
   ```

3. Start frontend (in new terminal):
   ```bash
   npm start
   ```

4. Make code changes (auto-reload enabled)

5. Test changes:
   ```bash
   npm test -- --watch=false --browsers=ChromeHeadless
   ```

6. Build verification:
   ```bash
   npm run build
   ```

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
- Backend connection issues: Ensure `docker compose --profile server up --build` is running and healthy
- Docker issues: `docker compose down` to reset Docker state

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