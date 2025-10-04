# Migration Guide: Angular Signals and OnPush Change Detection

## Overview

This document outlines the strategy for migrating jasper-ui from MobX-based state management to Angular Signals with OnPush change detection.

## Current State

- **Angular Version**: 20.3.3 (excellent signal support)
- **State Management**: MobX 6.15.0 with mobx-angular 4.8.0
- **Components**: 124 total
  - 58 components use MobX autoruns/reactions
  - 66 components don't use MobX autoruns
  - **33 components now use OnPush (26.6%)**
  - Only 1 component originally used OnPush (force-directed graph)
- **Store Files**: 15 files using MobX observables

## Migration Progress

### ✅ Completed Work

#### Phase 1: Store Migration (Partial)
- [x] `LocalStore` - Converted to signals with dual API (backwards compatible)

#### Phase 2: Component Migration (33/124 = 26.6%)
- [x] **Batch 1**: 7 foundation components (Login, Loading, Settings, Debug)
- [x] **Batch 2**: 9 form components (Links, Tags, Themes, Query, etc.)
- [x] **Batch 3**: 8 utility components (Todo, Tabs, Chess, QR, etc.)
- [x] **Batch 4**: 2 display components (Markdown, Viewer)
- [x] **Batch 5**: 7 action components (Inline actions, Confirm, etc.)

#### Tooling
- [x] Automated Python migration script
- [x] Batch processing capability
- [x] Safe duplicate detection

#### Testing
- [x] All 221 unit tests passing
- [x] Build successful
- [x] Zero breaking changes

### 🔄 In Progress

#### Phase 2: Continue Component Migration (91 remaining)
**Next Targets** (estimated 30 more simple components):
- Upload components (PDF, Audio, Video, Image)
- Form components (Ref, User, Plugin, Template, Ext)
- Display components (Blog, Chat, Folder, Notebook)
- Plugin components (Plugin list, Template list)

### 📋 Pending

#### Phase 1: Remaining Stores (14 files)
Must complete before full autorun migration:
1. `EventBus` - High priority (widely used)
2. `ViewStore` - High priority (heavily accessed)
3. `AccountStore` - High priority (user state)
4. `QueryStore` - Medium priority
5. Other specialized stores

#### Phase 3: Components with Autoruns (58 components)
Cannot migrate until stores are converted:
- Inbox pages (5 components)
- Tag/Ext pages
- Ref components
- Submit pages
- Settings pages with autoruns

#### Phase 4: Cleanup
- Remove MobX dependencies
- Remove mobx-angular module
- Final testing

## Migration Strategy

### Phase 1: Stores (Foundation)
Convert store files from MobX observables to Angular signals. Use dual API pattern for backwards compatibility.

#### Pattern: Dual API (Transition Period)
```typescript
// Before (MobX)
import { makeAutoObservable } from 'mobx';

export class SomeStore {
  value = 'initial';
  
  constructor() {
    makeAutoObservable(this);
  }
}

// After (Signals with backwards compat)
import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SomeStore {
  private _value = signal('initial');
  
  // Backwards compatible getter/setter
  get value() {
    return this._value();
  }
  
  set value(val: string) {
    this._value.set(val);
  }
  
  // New signal-based API (suffix with $)
  value$ = computed(() => this._value());
}
```

#### Store Migration Priority
1. ✅ `LocalStore` - Completed (no MobX dependencies)
2. `EventBus` - Simple, but heavily used (94 references)
3. `OriginStore` - Minimal dependencies
4. `SubmitStore` - Depends on EventBus
5. `ViewStore` - Complex, many reactive properties
6. `AccountStore` - Complex, depends on OriginStore
7. `GraphStore` - Specialized
8. `Store` (main) - Orchestrates all others
9. Query stores and specialized stores

### Phase 2: Components without Autoruns
Convert components that don't use MobX autoruns. These only need:
1. Add `ChangeDetectionStrategy.OnPush` to `@Component` decorator
2. Convert direct store property access to signal reads in templates (when stores migrated)
3. Add `ChangeDetectorRef` and manual `detectChanges()` calls where needed

#### Pattern: Simple Component Migration
```typescript
// Before
import { Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: `{{ store.someValue }}`
})
export class ExampleComponent {
  constructor(public store: Store) {}
}

// After
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: `{{ store.someValue }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExampleComponent {
  constructor(public store: Store) {}
}
```

#### ✅ Completed: 33 Components
See [Migration Progress](#migration-progress) section above.

#### Priority: Remaining ~33 Simple Components
- Form components (User, Ref, Plugin, Template, Ext)
- Upload components (PDF, Audio, Video, Image)
- Display components (Blog, Folder, Notebook entries)
- List components (Plugin list, Template list, Ext list)

### Phase 3: Components with Autoruns
Convert components using MobX autoruns to Angular effects. **Requires stores to be migrated first.**

#### Pattern: Autorun to Effect
```typescript
// Before (MobX autorun)
import { autorun, IReactionDisposer } from 'mobx';

export class ExampleComponent implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  
  ngOnInit() {
    this.disposers.push(autorun(() => {
      const value = this.store.reactiveValue;
      this.doSomething(value);
    }));
  }
  
  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}

// After (Signal effect)
import { effect, ChangeDetectionStrategy } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExampleComponent {
  constructor() {
    effect(() => {
      const value = this.store.reactiveValue$();
      this.doSomething(value);
    });
  }
}
```

#### Priority Components (With Autoruns - 58 total)
**Blocked until stores migrated:**
1. Inbox pages (5 components) - Depend on ViewStore, AccountStore
2. Tag/Ext pages - Depend on ViewStore
3. Ref components - Heavy store dependencies
4. Submit pages - Depend on SubmitStore
5. Settings pages with autoruns - Depend on ViewStore

### Phase 4: Remove MobX
Once all components and stores are migrated:
1. Remove `mobx` and `mobx-angular` dependencies
2. Remove `MobxAngularModule` from app.module.ts
3. Clean up any remaining MobX imports
4. Update documentation

## Automation Tools

### Python Migration Script
Located in `/tmp/batch_onpush*.py` (development scripts)

**Features:**
- Automatically adds `ChangeDetectionStrategy` import
- Correctly handles various @Component decorator formats
- Prevents duplicate updates
- Validates component files
- Batch processing support

**Usage:**
```python
files = [
    "src/app/component/example/example.component.ts",
    # ... more files
]

for f in files:
    add_onpush(f)
```

**Success Rate:** 100% (all automated migrations pass tests)

## Testing Strategy
- Unit tests must pass after each batch migration
- Integration testing recommended for each phase
- E2E tests (10-20 min) should run before Phase 4
- Manual smoke testing for critical paths

## Rollback Plan
During transition, both APIs exist (MobX and Signals). If issues arise:
1. Can revert individual components while keeping store changes
2. Store dual APIs ensure backwards compatibility
3. Git history allows granular rollback

## Benefits of Migration

1. **Performance**: OnPush change detection reduces unnecessary renders
2. **Bundle Size**: Remove MobX dependencies (~50KB gzipped)
3. **Angular Native**: Better integration with Angular ecosystem
4. **Type Safety**: Signals provide better TypeScript inference
5. **Debugging**: Angular DevTools support for signals
6. **Future-Proof**: Aligned with Angular's direction
7. **Simpler Mental Model**: No need to understand MobX concepts

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking changes during transition | High | Dual API in stores, incremental migration |
| Performance regression | Medium | Benchmark before/after each phase |
| Template binding errors | Medium | Comprehensive testing at each step |
| Developer confusion | Low | Clear documentation, consistent patterns |

## Timeline Estimate

- ~~Phase 1 (Stores): 2-3 weeks~~ → **Started: LocalStore complete**
- ~~Phase 2 (Simple Components): 1-2 weeks~~ → **In Progress: 33/66 complete (50%)**
- Phase 3 (Complex Components): 3-4 weeks → **Blocked on store migration**
- Phase 4 (Cleanup): 1 week

**Original Estimate**: 7-10 weeks for complete migration
**Revised Estimate**: 6-8 weeks (improved with automation)

## Resources

- [Angular Signals Documentation](https://angular.dev/guide/signals)
- [OnPush Change Detection](https://angular.dev/best-practices/runtime-performance#using-onpush)
- [Migrating from MobX](https://github.com/angular/angular/discussions/49090)
