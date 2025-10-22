# Vitest Migration Summary

## Overview
This document summarizes the migration from Karma to Vitest in the jasper-ui project, following Angular 20's experimental Vitest support documentation.

## What Was Accomplished

### 1. Application Builder Migration
- Migrated from `@angular-devkit/build-angular:browser` to `@angular/build:application` builder
- This migration was required as Vitest support only works with the application builder
- The application now builds successfully with the new builder

### 2. Dependency Changes
**Installed:**
- `vitest@^3.1.1` - Test runner
- `jsdom` - DOM implementation for Node.js
- `@vitest/browser@^3.1.1` - Browser mode support

**Removed:**
- `karma` - Old test runner
- `karma-chrome-launcher`
- `karma-coverage`
- `karma-jasmine`
- `karma-jasmine-html-reporter`  
- `karma-junit-reporter`
- `karma-html-reporter`
- `jasmine-core`
- `@types/jasmine`

### 3. Configuration Updates

**angular.json:**
- Changed test builder from `@angular-devkit/build-angular:karma` to `@angular/build:unit-test`
- Added `runner: "vitest"` option
- Added `buildTarget: "jasper-ui:build:development"` reference

**tsconfig.spec.json:**
- Removed `jasmine` from types array
- Added `vitest/globals` to types array  
- Removed references to `src/test.ts` and `src/polyfills.ts`

**Removed files:**
- `karma.conf.js`
- `karma-ci.conf.js`
- `src/test.ts`

### 4. Code Fixes for Application Builder Compatibility

**CSS Path Updates (`src/theme/*.scss`):**
- Changed webpack-style tilde paths (`~/assets/`) to absolute paths (`/assets/`)
- Esbuild (used by application builder) doesn't support webpack's tilde syntax

**JSZip Import Updates:**
```typescript
// Before (namespace import)
import * as JSZip from 'jszip';

// After (default import)  
import JSZip from 'jszip';
```
Files updated:
- `src/app/util/download.ts`
- `src/app/util/zip.ts`

**Webpack Loader Removal (`src/app/mods/root.ts`):**
- Removed `require('!!raw-loader!...')` calls
- These were used to embed TypeScript model files as strings in AI instructions
- Esbuild doesn't support webpack loaders
- Added TODO comment noting this limitation

## Current Status

### What Works
✅ Application builds successfully with `npm run build -- --configuration development`
✅ Vitest dependencies installed and configured
✅ TypeScript recognizes Vitest globals (describe, it, expect, etc.)

### What Doesn't Work
❌ Tests fail to compile with NG8001 errors

## The Remaining Issue

When running `npm test`, the Vitest unit-test builder attempts to compile the entire application and fails with errors like:

```
✘ [ERROR] NG8001: 'app-login-popup' is not a known element:
1. If 'app-login-popup' is an Angular component, then verify that it is part of this module.
```

### Analysis

1. **Components ARE properly declared:** All failing components are correctly declared in `src/app/app.module.ts`
2. **Regular build works:** Running `npm run build` succeeds, proving the module setup is correct
3. **Test-specific issue:** The problem only occurs during test compilation

This suggests the `@angular/build:unit-test` builder may not properly load Angular modules during test compilation. The experimental Vitest support may be optimized for standalone components and has issues with traditional NgModule-based applications like jasper-ui.

## Verification Steps

To verify the current state:

```bash
# Regular build works
npm run build -- --configuration development

# Test build fails with NG8001 errors  
npm test -- --watch=false
```

## Potential Solutions (Not Implemented)

1. **Convert to Standalone Components:** Migrate the entire application to use standalone components instead of NgModules. This is a major architectural change.

2. **Wait for Angular Updates:** The Vitest support is experimental. Future Angular CLI versions may fix module resolution issues.

3. **Use Alternative Test Runners:** Consider using other test runners that have better module-based app support, though this defeats the purpose of the Vitest migration.

4. **Custom Vitest Configuration:** The unit-test builder currently doesn't expose Vitest configuration options. Future Angular versions may add this capability.

## References

- [Angular Experimental Unit Testing Guide](https://angular.dev/guide/testing/unit-tests)
- [Vitest Documentation](https://vitest.dev/)
- [Angular CLI GitHub Issues - Vitest](https://github.com/angular/angular-cli/issues?q=vitest)
