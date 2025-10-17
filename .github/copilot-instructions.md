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
- Install Bun: `curl -fsSL https://bun.sh/install | bash`
- Install dependencies: `bun install --frozen-lockfile` (use `CYPRESS_INSTALL_BINARY=0 bun install --frozen-lockfile` if network blocks Cypress)

## Development Commands

### Frontend Only (Limited)
```bash
bun start  # Serves on http://localhost:4200/, expect API errors without backend
```

### Full Stack (Recommended)
```bash
# Terminal 1: Start backend
docker compose --profile server up --build

# Terminal 2: Start frontend (wait for backend health check)
bun start
```
- Backend: http://localhost:8081/
- Frontend: http://localhost:4200/

### Complete Docker Stack
```bash
docker compose up --build  # Everything on http://localhost:8082/
```

## Build & Test

- Build: `bun run build` (~100s, NEVER CANCEL, timeout 180+s)
- Unit tests: `bun test -- --watch=false --browsers=ChromeHeadless` (~55s, NEVER CANCEL, timeout 120+s) - runs Angular test suite
- Docker tests: `docker build . --target test -t jasper-ui-test && docker run --rm jasper-ui-test`
- E2E tests: `bun run cy:ci` (10-20 min, NEVER CANCEL, timeout 30+ min)
- Stop services: `docker compose down`

**IMPORTANT**: When making UI changes that affect user interactions (buttons, overlays, dialogs, etc.), **ALWAYS** update the corresponding Cypress E2E tests in `cypress/e2e/`. This is a critical step that should not be forgotten.

## Project Structure

- `src/app/mods/` - Plugin features (80+ files)
- `src/app/component/` - Reusable UI components
- `src/app/service/` - API and data services
- `src/app/store/` - MobX state management
- `docker-compose.yaml` - Development Docker setup
- `src/assets/config.json` - **DO NOT** edit API URL, use Docker env vars

## Localization & Translation

### Overview
Jasper-UI uses Angular's i18n system with XLIFF format for translations. The base file is `src/locale/messages.xlf` and language-specific files are named `messages.<locale>.xlf` (e.g., `messages.ja.xlf` for Japanese).

### Updating Translations

#### Step 1: Extract Latest Strings
Always start by extracting the latest translatable strings from the codebase:
```bash
bun run ng extract-i18n -- --output-path src/locale
```
This updates `src/locale/messages.xlf` with any new `$localize` strings from the code.

#### Step 2: Identify Missing Translations
Compare the base file with the target language file to find missing translations:
```bash
# Example for Japanese
comm -23 \
  <(grep -oP 'id="\K[^"]+' src/locale/messages.xlf | sort) \
  <(grep -oP 'id="\K[^"]+' src/locale/messages.ja.xlf | sort)
```

#### Step 3: Add Translations
For each missing translation ID:
1. Find the `<trans-unit>` entry in `messages.xlf`
2. Copy it to the appropriate location in `messages.<locale>.xlf`
3. Add a `<target>` element with the translated text

**Example:**
```xml
<trans-unit id="1234567890" datatype="html">
  <source>Configure AI</source>
  <target>AIを設定</target>
</trans-unit>
```

#### Step 4: Format Guidelines

**Newlines:** Use the same format as the source. If the source has actual newlines (blank lines), use them in the target too - do NOT use `\n` escape sequences.
```xml
<!-- CORRECT -->
<source>Line 1

Line 2</source>
<target>行1

行2</target>

<!-- WRONG -->
<target>行1\n\n行2</target>
```

**Redundant Translations:** Skip entries where the translation would be identical to the source (emojis, symbols, technical terms). Omit these `<trans-unit>` entries entirely from the translation file - the system will automatically fall back to the source text.
```xml
<!-- SKIP these in translation files -->
<trans-unit id="xxx">
  <source>🔎️🌐️</source>  <!-- Emoji - same in all languages -->
</trans-unit>
<trans-unit id="yyy">
  <source>LaTeX</source>  <!-- Technical term - unchanged -->
</trans-unit>
```

#### Step 5: Verify
Build the project to verify translations work correctly:
```bash
bun run build
```
- Check for "No translation found" warnings - expected for intentionally skipped entries
- Verify there are no errors for entries that should have translations

### Configuration
Translation locales are configured in `angular.json` under `projects.jasper-ui.i18n.locales`. The format is:
```json
"locales": {
  "ja": "src/locale/messages.ja.xlf"
}
```

## Key Info

- Angular 20 + TypeScript + MobX
- API configured via Docker `JASPER_API` environment variable
- Use `bun ng generate component|service|pipe|directive name` for new features
- Network issues: Use `CYPRESS_INSTALL_BINARY=0` flag
- Backend connection issues: Ensure `docker compose --profile server up --build` is healthy

## Theming

Jasper-UI supports both light and dark themes. The `body` element has either `light-theme` or `dark-theme` class applied based on user preference.

### Theme Variables

Theme-specific CSS variables are defined in:
- `src/theme/common.scss` - Default/base theme variables
- `src/theme/light.scss` - Light theme overrides (body.light-theme)
- `src/theme/dark.scss` - Dark theme overrides (body.dark-theme)

### Using Themes in Components

When styling components that need to adapt to themes:

1. **Use CSS variables** defined in theme files when possible:
   ```scss
   .my-element {
     background: var(--bg);
     color: var(--text);
     border: 1px solid var(--border);
   }
   ```

2. **Add theme-specific overrides in mod files** (NOT in component SCSS):
   
   Due to how Angular's view encapsulation works, theme-related CSS using `body.dark-theme` or `body.light-theme` selectors must be placed in the mod file's `css` property, not in component SCSS files.
   
   **Example (in `src/app/mods/mymod.ts`):**
   ```typescript
   export const myPlugin: Plugin = {
     tag: 'plugin/myplugin',
     name: $localize`My Plugin`,
     config: {
       // language=CSS
       css: `
         body.dark-theme {
           .my-component {
             background: rgba(20, 20, 20, 0.95);
             color: #c9c9c9;
           }
         }
         
         body.light-theme {
           .my-component {
             background: rgba(240, 240, 240, 0.95);
             color: #333;
           }
         }
       `,
       // ... other config
     }
   };
   ```
   
   **Component SCSS should only contain:**
   - Base styles (without theme selectors)
   - CSS variable usage
   - Component-scoped styles

3. **Test both themes** when adding new UI components to ensure good contrast and visibility in both modes.

### Common Theme Variables

- `--bg` - Main background color
- `--text` - Primary text color
- `--border` - Border colors
- `--active` - Active/selected states
- `--error` - Error states
- `--card` - Card backgrounds

See `src/theme/common.scss`, `src/theme/light.scss`, and `src/theme/dark.scss` for complete variable lists.