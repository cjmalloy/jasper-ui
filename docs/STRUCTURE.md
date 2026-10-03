# Ref / Tag CSS Structure

The UI shows two kinds of entity: **refs** and **tags**. Exts, Plugins, Templates and
Users all count as tags. Both kinds use the same two-line row layout:

```
[thumbnail?] line 1: title   (.link    — the main link, plus any toggles/badges)
             line 2: info    (.info    — who, when, tags, counts)
                     actions (.actions — fake-links, action components, action-list)
```

The selector names below are also exported from [`e2e/selectors.ts`](../e2e/selectors.ts), and
[`e2e/structure.spec.ts`](../e2e/structure.spec.ts) fails if a page drifts from this structure.

## Skeletons

### Ref (`app-ref`, `component/ref`)

```html
<app-ref class="ref list-item                 <!-- root + base row class -->
                ref-list-item | full-page     <!-- variant (set by the parent) -->
                thread parent-ref pinned      <!-- more variants (set by the parent) -->
                plugin_comment response-…     <!-- one class per plugin tag / response -->
                editing deleted upload exists outdated last-selected">  <!-- states -->
  <div class="row">                           <!-- line wrapper (flex): side columns + stack -->
    <div class="voting">…</div>               <!-- optional, vote-sorted lists only -->
    <div class="thumbnail"></div>             <!-- optional, before .link -->
    <div class="stack">
      <div class="link remote? redundant?">   <!-- LINE 1 -->
        <a>Title</a> <span class="host">(host)</span>
      </div>
      <div class="link-below">                <!-- layout: toggles around line 2 -->
        <button class="toggle">＋</button>
        <div class="stack">
          <div class="info">                  <!-- LINE 2 -->
            submitted 1 hour ago by <a class="user tag">bob</a>
            tagged <a class="tag">#science</a> <span class="icon">🔔️</span>
            on <a class="origin tag">@remote</a>
          </div>
          <app-viewer class="embed viewer-inline"/> <!-- optional inline expand -->
          <div class="actions">               <!-- ACTIONS: only action elements -->
            <a>permalink</a>
            <a class="fake-link">edit</a>
            <app-confirm-action class="action">delete</app-confirm-action>
            <app-action-list class="action-list">…</app-action-list>
          </div>
        </div>
        <div class="toggle actions-toggle">⚙️</div>
        <div class="toggle comments|threads|view">💬️</div>
      </div>
    </div>
  </div>
  <app-comment-reply class="comment-reply"/>  <!-- optional, after the row -->
  <app-viewer class="embed viewer-below"/>    <!-- optional expand; a nested ref inside is .ref.expand -->
  <form class="form">…</form>                 <!-- optional, when .editing -->
  <div class="error">…</div>
</app-ref>
```

### Tag (`app-ext`, `app-plugin`, `app-template`, `app-user`)

```html
<app-ext class="tag ext list-item             <!-- root + kind + base row class -->
                editing deleted upload exists outdated">  <!-- states -->
  <div class="link remote?">                  <!-- LINE 1 -->
    <a>Name</a> <span class="host">(tag@origin)</span>
  </div>
  <div class="stack">
    <div class="info">modified 1 hour ago</div>  <!-- LINE 2 -->
    <div class="actions">                     <!-- ACTIONS: only action elements -->
      <a>tags</a>
      <a class="fake-link">edit</a>
      <app-confirm-action class="action">delete</app-confirm-action>
    </div>
  </div>
  <form class="form">…</form>                 <!-- optional, when .editing -->
  <div class="diff-view form">…</div>         <!-- optional (plugin/template diff) -->
  <div class="error">…</div>
</app-ext>
```

The kind classes are `.ext`, `.plugin`, `.template` and `.profile` (users). Plugin and template rows
also get one class for their own tag (for example `plugin_thread`). Tag rows have no thumbnail or side
columns, so they leave out `.row`. Add `.row` only when the row needs a side column.

## Glossary

| Class | Slot / modifier / state | Meaning | Allowed parents |
|---|---|---|---|
| `.ref` | root | A Ref row. | list containers (`.list-container`), page body, `.lens`, `.responses-of`, `.sources-of` |
| `.tag` (on a row) | root | A tag-like row: Ext, Plugin, Template or User. Always pair it with `.list-item` or a kind class in selectors. | `.list-container`, upload page |
| `.list-item` | root base | Every entity row has it (including `.full-page`). Sets the row box model. | — (on the root) |
| `.ext` `.plugin` `.template` `.profile` | modifier (kind) | Which tag entity the row shows. | `.tag` root |
| `.full-page` | modifier | The main Ref on `/ref/:url/**`, and the `responseOf` / `sourcesOf` header in a lens. | `.ref` root |
| `.ref-list-item` | modifier | A Ref rendered by `app-ref-list`. | `.ref` root inside `.ref-list` |
| `.pinned` | modifier | A pinned Ref at the top of a list. | `.ref.ref-list-item` |
| `.thread` | modifier | Thread view of a full-page Ref. | `.ref.full-page`, `.ref.parent-ref` |
| `.parent-ref` | modifier | Parent Ref shown above a thread/comments page. | `.ref` root |
| `.plugin_*`, `.response-*`, `.user-response-*` | modifier | One per plugin tag, plugin response and user response (e.g. `.plugin_dm`, `.user-response-plugin_user_read`). | `.ref` root |
| `.editing` | state | The edit form is open. | root |
| `.deleted` | state | The entity was deleted (struck through). | root |
| `.upload` `.exists` `.outdated` | state | Unsaved upload; it already exists; the existing copy differs. | `.ref` / `.tag.ext` root |
| `.last-selected` | state | The row that was opened last. | `.ref` root |
| `.row` | layout | Flex line holding side columns (`.voting`, `.thumbnail`) and the `.stack`. | `.ref` root |
| `.stack` | layout | Flex column that stacks lines. | `.row`, `.link-below`, root |
| `.link-below` | layout | Holds line 2 plus the toggles around it. | `.ref .row > .stack` |
| `.voting` | slot (optional) | Up/down vote arrows. | `.row` |
| `.thumbnail` | slot (optional) | Thumbnail. Always before `.link`. | `.row` |
| `.link` | slot, line 1 | Main link/title, `.host`, badges. Modifiers: `.remote`, `.redundant`, `.comment-title`. | `.row > .stack`, tag root |
| `.host` | part of `.link` | `(host)` or `(tag@origin)` after the title. | `.link` |
| `.info` | slot, line 2 | Who, when, tags, icons, counts, origin. | `.stack` |
| `a.tag`, `a.user.tag`, `a.origin.tag` | part of `.info` | Inline tag/author/origin chip. It is always an `<a>`; don't confuse it with the `.tag` row root. | `.info`, markdown, breadcrumbs |
| `.icon` | part of `.info` | Clickable plugin icon. `.filter-toggle` when it toggles a filter. | `.info` |
| `.actions` | slot | Action strip. Direct children may only be `a`, `.fake-link`, `.action` or `.action-list`. | `.stack`, after `.info` |
| `.fake-link` | action | An `<a>` that runs code instead of navigating. | `.actions`, `.advanced-actions` |
| `.action` | action | Host class of `app-confirm-action`, `app-inline-button`, `app-inline-tag`, `app-inline-select`, `app-inline-password` and `app-inline-plugin`. | `.actions`, `.action-list`, `.advanced-actions` |
| `.action-list` | action | Plugin actions plus the `…` `.show-more` menu (`.advanced-actions`). | `.actions` |
| `.toggle` | control | Expand / ⚙️ / 💬️ / 🧵️ buttons beside line 2. | `.link-below` |
| `.embed` (`.viewer-inline` / `.viewer-below`) | expand | Expanded content (`app-viewer`). | `.link-below > .stack` / root |
| `.expand` | modifier | A Ref nested inside an `.embed` (repost, editing preview). | `.ref` root inside `.embed` |
| `.form` / `.diff-view` | expand | Edit/source form or diff, after the row. | root |
| `.error` / `.warning` | message | Server errors and warnings after the row. | root |

Classes that look alike but mean something else: `.ref-list` / `.ext-list` / `.plugin-list` / `.template-list` /
`.user-list` are list containers; `.full-page-form` and `.full-page-upload` are page layouts, not entity variants.

## Page map

| Route | Renders | Root class of each row |
|---|---|---|
| `/home`, `/tag/:tag` | `app-lens` → `app-ref-list` (or a template view: kanban, grid, notes, blog, chat, …) | `.ref.list-item.ref-list-item` |
| `/tag/:tag?filter=responses/<url>` (or `sources/<url>`) | `app-lens` header + `app-ref-list` | `.ref.full-page` + `.ref.ref-list-item` |
| `/ref/:url` | `app-ref.full-page` + `app-ref-list` of responses (summary) | `.ref.full-page`, `.ref.ref-list-item` |
| `/ref/:url/thread` | `app-ref.full-page.thread` (+ `.parent-ref`) + `app-ref-list` | `.ref.full-page.thread`, `.ref.ref-list-item` |
| `/ref/:url/comments` | `app-ref.full-page` + `app-comment-thread` | `.ref.full-page`, `.comment` (see below) |
| `/ref/:url/responses`, `sources`, `alts`, `errors`, `versions` | `app-ref.full-page` + `app-ref-list` | `.ref.full-page`, `.ref.ref-list-item` |
| `/inbox/*` | `app-ref-list` | `.ref.ref-list-item` |
| `/tags/:template` | `app-ext-list` | `.tag.ext.list-item` |
| `/settings/plugin` | `app-plugin-list` | `.tag.plugin.list-item` |
| `/settings/template` | `app-template-list` | `.tag.template.list-item` |
| `/settings/user` | `app-user-list` | `.tag.profile.list-item` |
| `/settings/ref/:tag` | `app-ref-list` | `.ref.ref-list-item` |
| `/settings/backup` | `app-backup-list` | `.backup` (not an entity, but uses the same `.link` / `.info` / `.actions` slots) |
| `/submit/web` (existing / responses / unsaved) | `app-ref` | `.ref.list-item` |
| `/submit/upload` | `app-ext`, `app-ref` | `.tag.ext.upload`, `.ref.upload` |
| `/ext/:tag`, `/user/:tag`, `/settings/me`, `/submit/*` forms | entity forms | `.full-page-form` (form page, not a row) |

Plugin-specific ref views (`.comment`, `.blog-entry`, `.chat-entry`, `.kanban-card`, `.note`, …) render refs in
their own layouts. They are not `.ref` rows and are not checked by `e2e/structure.spec.ts`.

## Inventory (before standardizing)

What the code and e2e specs already relied on, and what changed:

- **Kept (cowpaths):** `.ref`, `.list-item`, `.full-page`, `.ref-list-item`, `.thread`, `.link`, `.info`,
  `.actions`, `.fake-link`, `.action`, `.thumbnail`, `.row`, `.deleted`, `.upload`, `.exists`, `.outdated`,
  `a.tag` / `a.user.tag` / `a.origin.tag` chips, `.backup`, `.error-404`. E2E specs use
  `.full-page.ref .link a`, `.full-page.ref .actions .fake-link`, `.full-page.ref .tag:not(.user)`,
  `.ref-list-item .link a`, `.backup .link a`, `.${type}.list-item` and so on.
- **Tag rows had no shared root.** Ext, Plugin, Template and User rows used `.ext`, `.plugin`, `.template` and
  `.profile`. They now also have `.tag`; the old classes stay as kind modifiers.
- **`.tag` meant two things.** Chips were styled with a bare `.tag` rule, so a `.tag` row root would have
  picked up chip colors and margins. The chip rules in `theme/common.scss` and `theme/light.scss` are now
  scoped to `a.tag` (every chip is an `<a>`), so rows look the same.
- **`.ext.upload` only covered Exts.** It is now `.tag.upload`.
- **No `.editing` state.** Rows only had an `editing` field. Refs and tags now set the `.editing` class on the root.
- **`app-action-list` had no class**, so `.actions` children couldn't be checked without selecting a custom
  tag. It now has `.action-list`.
- **Known, intentionally left alone** (fixing them would change how things look):
  - Refs wrap line 2 in `.row > .stack > .link-below > .stack`, while tags use a flat `.stack`.
  - In the sidebar, `.ref, .ext` (not every `.tag`) get the nowrap / 28px rules.
  - The origin in an Ext's `.info` is a plain `<a>`, not an `a.origin.tag` chip.
  - Only refs in lists get a list modifier (`.ref-list-item`); tag rows are identified by their list container.
