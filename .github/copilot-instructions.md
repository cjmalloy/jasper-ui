# Jasper-UI Development Guide

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Quick Start

- **CRITICAL**: Debugging requires the Jasper server backend running
- Install Node.js 22: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`
- Install dependencies: `npm ci` (use `CYPRESS_INSTALL_BINARY=0 npm ci` if network blocks Cypress)

## Development Commands

### Frontend Only (Limited)
```bash
npm start  # Serves on http://localhost:4200/, expect API errors without backend
```

### Full Stack (Recommended)
```bash
# Terminal 1: Start backend
docker compose --profile server up --build

# Terminal 2: Start frontend (wait for backend health check)
npm start
```
- Backend: http://localhost:8081/
- Frontend: http://localhost:4200/

### Complete Docker Stack
```bash
docker compose up --build  # Everything on http://localhost:8082/
```

## Build & Test

- Build: `npm run build` (90-120s, NEVER CANCEL, timeout 180+s)
- Unit tests: `npm test -- --watch=false --browsers=ChromeHeadless` (45-60s, NEVER CANCEL, timeout 120+s)
- Docker tests: `docker build . --target test -t jasper-ui-test && docker run --rm jasper-ui-test`
- E2E tests: `npm run cy:ci` (10-20 min, NEVER CANCEL, timeout 30+ min)
- Stop services: `docker compose down`

## Project Structure

- `src/app/mods/` - Plugin features (80+ files)
- `src/app/component/` - Reusable UI components
- `src/app/service/` - API and data services
- `src/app/store/` - MobX state management
- `docker-compose.yaml` - Development Docker setup
- `src/assets/config.json` - **DO NOT** edit API URL, use Docker env vars

## Key Info

- Angular 20 + TypeScript + MobX
- API configured via Docker `JASPER_API` environment variable
- Use `ng generate component|service|pipe|directive name` for new features
- Network issues: Use `CYPRESS_INSTALL_BINARY=0` flag
- Backend connection issues: Ensure `docker compose --profile server up --build` is healthy