# Jasper-UI Development Guide

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## What is Jasper?

Jasper is an open source knowledge management (KM) system. Unlike a CMS, Jasper stores links to content rather than content itself, creating a fast overlay database that indexes content sources. The system uses composite keys with five core entities:

1. **Ref** - References to external resources (composite key: url + origin, URLs must be valid RFC 3986 URIs)
2. **Ext** - Tag extensions that customize tag pages (composite key: tag + origin)
3. **User** - User entities with Tag-Based Access Control (composite key: tag + origin)
4. **Plugin** - Extends Ref functionality with JTD schemas (composite key: tag + origin)
5. **Template** - Extends Ext functionality with JTD schemas (composite key: tag + origin)

**Key Concepts:**
- **Tags**: Hierarchical strings (`public`, `+protected`, `_private`) for categorization and access control
  - Regex: `[_+]?[a-z0-9]+([./][a-z0-9]+)*`
- **Origins**: Enable replication and multi-tenant operation (`@origin`). Allow read-only pull-based collaboration without write access to remote servers
  - Regex: `@[a-z0-9]+([.][a-z0-9])*`
- **URLs**: Must be valid URIs per RFC 3986 for Ref composite keys
- **Modding**: Extensive customization via plugins/templates without server restarts. Client-only changes using Plugin/Template entities with JTD schema validation
- **Access Control**: Hierarchical roles (Anonymous, Viewer, User, Editor, Mod, Admin) plus Tag-Based Access Control (TBAC)
- **Layers**: Identity layer (URL/Tag + Origin + Modified), Business layer, Application layer
- **Special URLs**: `cache:` scheme for file cache, `tag:` scheme for tag references
- **Querying**: Set-like operators (`:` and, `|` or, `!` not, `()` groups) to find content
  - `science`: All Refs with `science` tag
  - `science|funny`: Refs with either tag
  - `science:funny`: Refs with both tags
  - `science:!funny`: Refs with `science` but not `funny`
  - `(science|math):funny`: Refs with (`science` OR `math`) AND `funny`
  - `music:people/murray`: Matches hierarchical tags like `people/murray/anne`

This Angular client (jasper-ui) provides the reference implementation for interacting with the Jasper knowledge management server.

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

- Build: `npm run build` (~100s, NEVER CANCEL, timeout 180+s)
- Unit tests: `npm test -- --watch=false --browsers=ChromeHeadless` (~55s, NEVER CANCEL, timeout 120+s) - runs Angular test suite
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