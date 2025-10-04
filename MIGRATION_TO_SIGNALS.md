# Migration Guide: Angular Signals and OnPush Change Detection

## Overview

This document outlines the strategy for migrating jasper-ui from MobX-based state management to Angular Signals with OnPush change detection.

## Current State

- **Angular Version**: 20.3.3 (excellent signal support)
- **State Management**: MobX 6.15.0 with mobx-angular 4.8.0
- **Components**: 124 total
  - 58 components use MobX autoruns/reactions
  - 66 components don't use MobX autoruns
  - Only 1 component currently uses OnPush (force-directed graph)
- **Store Files**: 15 files using MobX observables

## Migration Strategy

### Phase 1: Stores (Foundation)
Convert store files from MobX observables to Angular signals. This must be done carefully to maintain backwards compatibility during migration.

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
Convert the 66 components that don't use MobX autoruns. These only need:
1. Add `ChangeDetectionStrategy.OnPush` to `@Component` decorator
2. Convert direct store property access to signal reads in templates
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
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: `{{ store.someValue$ }}`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExampleComponent {
  constructor(
    public store: Store,
    private cd: ChangeDetectorRef
  ) {}
}
```

#### Priority Components (No Autoruns)
1. ✅ `LoginPage` - Completed (trivial)
2. `SettingsPage` - Simple page
3. Form components (11 total)
4. Kanban components
5. Various utility components

### Phase 3: Components with Autoruns
Convert the 58 components using MobX autoruns to Angular effects. This is the most complex phase.

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

#### Priority Components (With Autoruns)
1. Inbox pages (5 components)
2. Tag/Ext pages
3. Ref components
4. Submit pages
5. Settings pages

### Phase 4: Remove MobX
Once all components and stores are migrated:
1. Remove `mobx` and `mobx-angular` dependencies
2. Remove `MobxAngularModule` from app.module.ts
3. Clean up any remaining MobX imports
4. Update documentation

## Implementation Notes

### Completed Work
- ✅ Converted `LocalStore` to signals with dual API
- ✅ Added OnPush to `LoginPage`
- ✅ All tests passing (221/221)
- ✅ Build successful

### Next Steps
1. Convert `EventBus` to signals (high priority, widely used)
2. Convert inbox pages as proof-of-concept for autorun migration
3. Create automated migration scripts where possible
4. Document patterns and gotchas

### Testing Strategy
- Unit tests must pass after each store migration
- Integration testing required for each phase
- E2E tests (10-20 min) should run before Phase 4

### Rollback Plan
During transition, both APIs exist (MobX and Signals). If issues arise:
1. Can revert individual components while keeping store changes
2. Store dual APIs ensure backwards compatibility
3. Git history allows granular rollback

## Benefits of Migration

1. **Performance**: OnPush change detection reduces unnecessary renders
2. **Bundle Size**: Remove MobX dependencies
3. **Angular Native**: Better integration with Angular ecosystem
4. **Type Safety**: Signals provide better TypeScript inference
5. **Debugging**: Angular DevTools support for signals
6. **Future-Proof**: Aligned with Angular's direction

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking changes during transition | High | Dual API in stores, incremental migration |
| Performance regression | Medium | Benchmark before/after each phase |
| Template binding errors | Medium | Comprehensive testing at each step |
| Developer confusion | Low | Clear documentation, consistent patterns |

## Timeline Estimate

- Phase 1 (Stores): 2-3 weeks
- Phase 2 (Simple Components): 1-2 weeks  
- Phase 3 (Complex Components): 3-4 weeks
- Phase 4 (Cleanup): 1 week

**Total**: 7-10 weeks for complete migration

## Resources

- [Angular Signals Documentation](https://angular.dev/guide/signals)
- [OnPush Change Detection](https://angular.dev/best-practices/runtime-performance#using-onpush)
- [Migrating from MobX](https://github.com/angular/angular/discussions/49090)
