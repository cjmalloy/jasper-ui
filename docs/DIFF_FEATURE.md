# Reference Version Diff Feature

## Overview

This feature adds the ability to compare different versions of a reference using a Monaco diff editor. When a reference has multiple versions (stored in different origins), users can now view a side-by-side comparison of the local version against remote versions.

## Implementation

### Components

#### DiffEditorComponent (`src/app/component/diff-editor/`)
A new component that wraps the Monaco diff editor to display differences between two reference versions.

**Features:**
- Side-by-side diff view using Monaco Editor
- Automatic theme switching (light/dark) based on user preferences
- JSON formatting for easy comparison
- Close button to dismiss the overlay

**Inputs:**
- `original`: The original (remote) Ref to compare
- `modified`: The modified (local) Ref to compare

**Outputs:**
- `close`: Event emitted when the user closes the diff overlay

### RefComponent Changes

#### New Properties
- `diffOverlayRef`: Manages the CDK overlay for displaying the diff editor
- `diffOriginal`: Stores the remote reference for comparison
- `diffModified`: Stores the local reference for comparison
- `hasDiff`: Computed property that returns true when diff should be available

#### New Methods

**`diff$()`**
- Fetches obsolete versions of the current reference
- Finds the most recently modified remote version
- Retrieves the local version
- Opens the diff overlay with both versions

**`showDiffOverlay()`**
- Creates and displays a fullscreen overlay with the diff editor
- Centers the overlay on screen
- Adds backdrop click handling to close

**`closeDiffOverlay()`**
- Disposes of the overlay and cleans up resources

### UI Changes

#### Diff Button
A new "diff" button appears in the actions area when:
- `store.view.versions > 0` (there are multiple versions available)
- `!local` (the current reference is not from the local origin)

#### Copy Button Visibility
The "copy" button is now hidden when the "diff" button is available, preventing duplicate actions.

## User Workflow

1. User navigates to a reference that has multiple versions (remote and local)
2. The "diff" button appears in the actions area
3. User clicks the "diff" button
4. System fetches all obsolete versions and the local version
5. A fullscreen overlay opens showing:
   - Left side: Most recent remote version (as JSON)
   - Right side: Local version (as JSON)
   - Differences highlighted by Monaco editor
6. User can review changes and close the overlay

## Technical Details

### Version Detection
- Versions are detected using the `store.view.versions` property
- This property is populated by counting refs with `obsolete: true` flag for the same URL

### Version Fetching
- Remote versions are fetched using `refs.page()` with `obsolete: true` and sorted by `modified,DESC`
- The most recent remote version (where `origin !== store.account.origin`) is selected for comparison
- Local version is fetched using `refs.get()` with the local origin

### Data Format
- References are serialized using `writeRef()` before comparison
- JSON is pretty-printed with 2-space indentation for readability
- Monaco editor provides syntax highlighting and diff visualization

## Dependencies

- **ngx-monaco-editor**: Provides the Monaco diff editor component
- **@angular/cdk/overlay**: Manages the overlay positioning and backdrop
- **mobx**: For reactive theme switching

## Testing

- All existing unit tests (221) continue to pass
- Build completes successfully without errors
- Component is properly registered in `app.module.ts`

## Future Enhancements

Potential improvements for this feature:
1. Allow selection of which remote version to compare (not just the most recent)
2. Add merge/copy functionality from the diff view
3. Support comparing any two versions, not just local vs remote
4. Add visual indicators showing which fields changed
5. Include metadata comparison (tags, plugins, etc.)
