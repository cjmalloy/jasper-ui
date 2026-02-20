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
- Add screenshots to your comments using playwrite for UI changes in both light and dark mode

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
- Unit tests: `npm test -- --watch=false` (~55s, NEVER CANCEL, timeout 120+s) - runs Vitest via Angular CLI
- Docker tests: `docker build . --target test -t jasper-ui-test && docker run --rm jasper-ui-test`
- E2E tests: `npm run pw:ci` (10-20 min, NEVER CANCEL, timeout 30+ min)
- Stop services: `docker compose down`

**IMPORTANT**: When making UI changes that affect user interactions (buttons, overlays, dialogs, etc.), **ALWAYS** update the corresponding Playwright E2E tests in `e2e/`. This is a critical step that should not be forgotten.

## Project Structure

- `src/app/component/` - Reusable UI components
- `src/app/directive/` - Custom directives
- `src/app/form/` - Form components
- `src/app/formly/` - Formly form integration
- `src/app/guard/` - Route guards
- `src/app/http/` - HTTP interceptors
- `src/app/model/` - Data models (Ref, Ext, User, Plugin, Template)
- `src/app/mods/` - Plugin features (70+ files)
- `src/app/page/` - Page components
- `src/app/pipe/` - Custom pipes
- `src/app/service/` - API and data services
- `src/app/store/` - MobX state management
- `src/app/util/` - Utility functions
- `docker-compose.yaml` - Development Docker setup
- `src/assets/config.json` - **DO NOT** edit API URL, use Docker env vars

## Localization & Translation

### Overview
Jasper-UI uses Angular's i18n system with XLIFF format for translations. The base file is `src/locale/messages.xlf` and language-specific files are named `messages.<locale>.xlf` (e.g., `messages.ja.xlf` for Japanese).

### Updating Translations

#### Step 1: Extract Latest Strings
Always start by extracting the latest translatable strings from the codebase:
```bash
npm run ng extract-i18n -- --output-path src/locale
```
This updates `src/locale/messages.xlf` with any new `$localize` strings from the code.

#### Step 2: Remove Obsolete Translations
**IMPORTANT**: Remove translations that no longer exist in the base file to keep the translation file in sync:
```bash
# Example for Japanese - identify obsolete translations
comm -13 \
  <(grep -oP 'id="\K[^"]+' src/locale/messages.xlf | sort) \
  <(grep -oP 'id="\K[^"]+' src/locale/messages.ja.xlf | sort)
```
Remove any `<trans-unit>` entries whose IDs appear in this list - they are no longer used in the codebase.

#### Step 3: Identify Missing Translations
Compare the base file with the target language file to find missing translations:
```bash
# Example for Japanese
comm -23 \
  <(grep -oP 'id="\K[^"]+' src/locale/messages.xlf | sort) \
  <(grep -oP 'id="\K[^"]+' src/locale/messages.ja.xlf | sort)
```

#### Step 4: Add Translations
For each missing translation ID:
1. Find the `<trans-unit>` entry in `messages.xlf`
2. Copy **only** the `<source>` element to the appropriate location in `messages.<locale>.xlf`
3. Add a `<target>` element with the translated text
4. **DO NOT** include `<context-group>` elements - they are not needed in translation files

**Example:**
```xml
<trans-unit id="1234567890" datatype="html">
  <source>Configure AI</source>
  <target>AIを設定</target>
</trans-unit>
```

#### Step 5: Format Guidelines

**No Context Groups:** Translation files should NOT include `<context-group>` elements. Only include `<source>` and `<target>` (if translated) in each `<trans-unit>`.

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

**Untranslated Entries:** For entries where the translation would be identical to the source (emojis, symbols, technical terms), include a source-only `<trans-unit>` (no `<target>`) to prevent build warnings.
```xml
<!-- Include these with source only in translation files -->
<trans-unit id="xxx" datatype="html">
  <source>🔎️🌐️</source>  <!-- Emoji - no translation needed -->
</trans-unit>
<trans-unit id="yyy" datatype="html">
  <source>LaTeX</source>  <!-- Technical term - no translation needed -->
</trans-unit>
```

#### Step 6: Verify
Build the project to verify translations work correctly:
```bash
npm run build
```
- There should be NO "No translation found" warnings if all source-only entries are included
- Verify there are no errors for entries that should have translations

### Configuration
Translation locales are configured in `angular.json` under `projects.jasper-ui.i18n.locales`. The format is:
```json
"locales": {
  "ja": "src/locale/messages.ja.xlf"
}
```

## E2E Testing with Playwright

### Overview

E2E tests live in `e2e/` and use Playwright. The test environment requires Docker services running (main app on `http://localhost:8080`, replica on `http://localhost:8082`).

### Environment Setup

Start the e2e Docker services before running or debugging tests:
```bash
cd e2e && docker compose pull && docker compose up --build -d
```
Wait for services to be healthy, then run tests:
```bash
npx playwright test                  # Run all tests headless
npx playwright test 00-smoke.spec.ts # Run a single test file
npx playwright test --ui             # Interactive UI mode
```
Stop services when done:
```bash
cd e2e && docker compose down
```

### Debug Users

The app supports debug query parameters to simulate different user roles without authentication:
- `?debug=ADMIN` - Full admin access
- `?debug=MOD` - Moderator access
- `?debug=EDITOR` - Editor access
- `?debug=USER` - Standard user access
- `?debug=VIEWER` - Read-only access
- `?debug=ANON` - Anonymous/unauthenticated access

Always append the appropriate debug parameter when navigating in tests:
```typescript
await page.goto('/?debug=ADMIN');
await page.goto('/settings/setup?debug=ADMIN');
```

### Using the Playwright MCP Server for Debugging

The Playwright MCP server allows interactive browser automation to debug and write e2e tests. Use these tools in the following workflow:

#### Step 1: Start Services and Navigate
```
navigate to http://localhost:8080/?debug=ADMIN
```
Use `browser_navigate` to load the page under test with the appropriate debug user.

#### Step 2: Inspect the Page
Use `browser_snapshot` to capture an accessibility snapshot of the current page. This returns a structured tree of all visible elements with their roles, names, and unique `ref` attributes. The snapshot is more reliable than screenshots for identifying interactive elements and building selectors.

Use `browser_take_screenshot` to capture a visual screenshot when you need to verify layout, styling, or visual state.

#### Step 3: Interact with Elements
Use the element `ref` from the snapshot to interact with the page:
- `browser_click` - Click buttons, links, checkboxes
- `browser_type` - Type into text fields
- `browser_fill_form` - Fill multiple form fields at once
- `browser_select_option` - Select dropdown options
- `browser_hover` - Hover over elements to reveal tooltips or menus

#### Step 4: Translate to Test Code
Map MCP interactions to Playwright test assertions and actions:

| MCP Tool | Playwright Equivalent |
|---|---|
| `browser_navigate` | `page.goto(url)` |
| `browser_snapshot` | Use to discover selectors for `page.locator()` |
| `browser_click` (by selector) | `page.locator('button', { hasText: 'Submit' }).click()` |
| `browser_click` (by text) | `page.getByText('Submit').click()` |
| `browser_type` | `page.locator('#url').fill('value')` |
| `browser_take_screenshot` | `expect(page.locator('.element')).toBeVisible()` |

### CSS Selector Guidelines

A project goal is to have a **very simple and easy to navigate CSS tree**. Follow these rules when adding or changing components:

- **Always add descriptive `class` attributes** to interactive and structurally significant elements so E2E tests can target them without relying on tag names or brittle nth-child selectors.
- **Never rely on tag names** (e.g., `select`, `div`, `span`) as primary selectors in E2E tests — use CSS classes instead.
- **Use clear, semantic class names** that describe the element's role in the UI, not its appearance or implementation. Examples:
  - `.filter-toggle` — the button/element that opens the filter/params panel
  - `.filter-preview` — the inline summary shown when params are set
  - `.bookmark-field` — the host element for a bookmark formly field
  - `.params-panel` — the overlay popup panel
- **Add host classes** to formly field components (`host: { 'class': 'field my-field-type' }`) so tests can scope to that component type without using its tag name.
- When creating new interactive UI elements (buttons, overlays, toggles), always give them a descriptive class before writing E2E tests for them.

### Writing New E2E Tests

#### File Naming Convention
Test files are numbered for execution order: `00-smoke.spec.ts`, `01-backup.spec.ts`, etc. Plugin tests use `plugin-<name>.spec.ts`, template tests use `template-<name>.spec.ts`.

#### Test Structure
```typescript
import { expect, test } from '@playwright/test';
import { clearMods, mod, openSidebar, deleteRef } from './setup';

test.describe.serial('Feature Name', () => {
  // Always clear/set mods first if the test requires specific plugins
  test('clear mods', async ({ page }) => {
    await mod(page, '#mod-feature');
  });

  test('does something', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    // ... test actions and assertions
  });
});
```

#### Setup Helpers (`e2e/setup.ts`)
- `clearMods(page, base?)` - Remove all plugins and templates
- `clearAll(page, base?, origin?)` - Delete all data for an origin and clear mods
- `deleteRef(page, url, base?)` - Delete a specific ref by URL
- `mod(page, ...mods)` - Clear mods then enable specified mods (e.g., `'#mod-wiki'`, `'#mod-graph'`)
- `modRemote(page, base, ...mods)` - Same as `mod` but for a remote instance
- `openSidebar(page)` / `closeSidebar(page)` - Toggle the sidebar

#### Using MCP to Discover Selectors
When writing a new test, use the MCP server to find the right selectors:
1. Navigate to the page: `browser_navigate` to `http://localhost:8080/?debug=ADMIN`
2. Take a snapshot: `browser_snapshot` to see all interactive elements
3. Try clicking elements: `browser_click` to verify the correct element is targeted
4. Check results: `browser_snapshot` again to verify state changes

### Debugging Failing Tests

#### Using MCP Server to Reproduce Failures
1. Start the Docker services and navigate to the same URL the failing test uses
2. Use `browser_snapshot` to inspect the current page state
3. Replay the test steps one at a time using MCP tools (`browser_click`, `browser_type`, etc.)
4. After each step, use `browser_snapshot` to compare actual vs expected state
5. Use `browser_take_screenshot` if the visual layout is relevant to the failure
6. Use `browser_console_messages` to check for JavaScript errors
7. Use `browser_network_requests` to inspect API call failures

#### Common Issues
- **Element not found**: Use `browser_snapshot` to find the actual element structure; selectors may have changed
- **Timing issues**: Add `waitForLoadState('networkidle')` or `waitForResponse()` before assertions
- **State pollution**: Tests run serially in one worker; a prior test may have left unexpected state. Use `clearMods` or `clearAll` in setup
- **Mobile layout triggered**: Viewport is set to 1280x720 in `playwright.config.ts` to prevent mobile layout; verify `browser_resize` matches if testing interactively

## Key Info

- Angular 20 + TypeScript + MobX + Vitest
- API configured via Docker `JASPER_API` environment variable
- Use `ng generate component|service|pipe|directive name` for new features
- Network issues: Playwright browsers are bundled, no separate install needed
- Backend connection issues: Ensure `docker compose --profile server up --build` is healthy

## Theming

Jasper-UI supports both light and dark themes. The `body` element has either `light-theme` or `dark-theme` class applied based on user preference.

### Theme Variables

Theme-specific CSS variables are defined in:
- `src/theme/common.scss` - Default/base theme variables
- `src/theme/light.scss` - Light theme overrides (body.light-theme)
- `src/theme/dark.scss` - Dark theme overrides (body.dark-theme)
- `src/theme/light-highlight.scss` - Light theme syntax highlighting
- `src/theme/dark-highlight.scss` - Dark theme syntax highlighting
- `src/theme/mobile.scss` - Mobile-specific styles
- `src/theme/print.scss` - Print styles
- `src/theme/android.scss` - Android platform styles
- `src/theme/electron.scss` - Electron platform styles
- `src/theme/mac.scss` - macOS platform styles

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
