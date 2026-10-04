# Theming Jasper: Structure and Classes

Jasper is mostly a shell around user content, so a custom theme can restyle almost everything
with plain CSS. Every entity row is either a **ref** or a tag-like entity (**ext**, **plugin**,
**template**, **user**), and they all use the same slots:
`.thumbnail?` → `.link` (line 1) → `.info` (line 2) → `.actions`.

Tags are plain strings, not entities. The `.tag` class is only used for inline tag links.

## Skeletons

```html
<!-- Ref -->
<app-ref class="ref list-item">
  <div class="voting">…</div>                            <!-- optional -->
  <div class="thumbnail"></div>                          <!-- optional -->
  <div class="link">…</div>                              <!-- line 1: title -->
  <button class="toggle">…</button>                      <!-- optional: expand toggle -->
  <div class="info">…</div>                              <!-- line 2: metadata -->
  <app-viewer class="viewer-inline embed">…</app-viewer> <!-- optional: inline viewer -->
  <div class="actions">…</div>                           <!-- line 3: links / buttons -->
  <div class="toggle actions-toggle">…</div>             <!-- mobile only -->
  <div class="toggle threads | comments | view">…</div>  <!-- mobile only -->
  <app-viewer class="viewer-below embed">…</app-viewer>  <!-- optional: viewer below the row -->
</app-ref>

<!-- Ext, Plugin, Template or User (root class: ext | plugin | template | profile) -->
<app-ext class="ext list-item">
  <div class="link">…</div>                              <!-- line 1: title -->
  <div class="info">…</div>                              <!-- line 2: metadata -->
  <div class="actions">…</div>                           <!-- line 3: links / buttons -->
</app-ext>
```

There are no layout wrappers. Every `.list-item` is a CSS grid, and the slots are its direct children.
Tag-like rows use a single column. Ref rows use these named column lines:

| Column | Holds |
|---|---|
| `voting` | `.voting`, spanning the same rows as `.thumbnail` |
| `thumbnail` | `.thumbnail`, spanning the `.link`, `.info`, `.viewer-inline` and `.actions` rows |
| `toggle` | The expand toggle, to the left of `.info` and `.actions`. `.link` starts here. |
| `main` | `.info`, `.viewer-inline` and `.actions` |
| `actions-toggle`, `nav-toggle` | Mobile toggles |
| `end` | End of `.link` |

Anything else (`.viewer-below`, the edit form, errors) spans the full width below the row.
Always use child selectors such as `.ref > .info`. A descendant selector such as `.ref .info` also
matches Refs nested inside an `.embed`.

The layout only uses CSS Grid Level 1, so it also works on iOS 13. It doesn't need subgrid, `:has()`,
`:is()`, `:where()` or `@layer`.

## Selectors

| Selector | Matches |
|---|---|
| `.ref` | Ref rows |
| `.ext`, `.plugin`, `.template`, `.profile` | Ext, Plugin, Template and User rows |
| `.list-item` | Any entity row |
| `.thumbnail`, `.link`, `.info`, `.actions` | Row slots |
| `.embed` | Expanded Ref viewer (`.viewer-inline` between `.info` and `.actions`, or `.viewer-below` after the row) |
| `.editing` | Row with the edit form open |
| `.tag` | Inline tag links (not rows) |

User rows use `.profile` for the permission entity, and user tag links use `.user`.

## CSS variables

If you only want to change colours, override these variables. They are set on `<body>` in
`src/theme/common.scss`, `light.scss` and `dark.scss`. Set them for both `body.light-theme` and
`body.dark-theme`, because Jasper switches between the two to match the user's colour scheme.

When you add a new theme in the **Custom Themes** form, it starts with every variable below,
pre-filled with the values currently in use for light and dark mode, plus comments to get you started.

| Variable | Used for | Light | Dark |
|---|---|---|---|
| `--bg` | Page background | `white` | `#343434` |
| `--bg-accent` | Subtle background for panels and tabs | `rgba(0, 0, 0, 0.05)` | `rgba(90, 90, 90, 0.05)` |
| `--bg-hover` | Background on hover and drop targets | `rgba(0, 0, 0, 0.1)` | `rgba(255, 255, 255, 0.1)` |
| `--bg-active` | Background while pressed or selected | `rgba(0, 0, 0, 0.4)` | `rgba(255, 255, 255, 0.4)` |
| `--text` | Main text colour | `black` | `#c9c9c9` |
| `--link` | Link colour | not set | `#5769c2` |
| `--visited` | Visited link colour | `#551a8b` | `#c66acb` |
| `--active` | Highlights such as the current page and new response counts | `#da0000` | `#dc5c5c` |
| `--info` | Secondary text such as row info, quotes and timestamps | `gray` | `#969696` |
| `--tag` | Inline tag links and accents | `#3d3dbb` | `#af5800` |
| `--tag-accent` | Inline tag link background (light theme) | `#f3ebc7` | `#f3ebc7` |
| `--blue` | Tab bar background (light theme) | `rgba(207, 221, 255, 0.7)` | `rgba(207, 221, 255, 0.7)` |
| `--toggle` | Toggle button background | `#CCC` | `#525252` |
| `--toggle-accent` | Toggle button background on hover | `#BBB` | `#777` |
| `--toggle-active` | Toggle button background while pressed | `#AAA` | `#888` |
| `--toggle-border` | Toggle button border | `grey` | `transparent` |
| `--form-bg` | Form input background | `white` | `#3b3b3b` |
| `--border` | Main border colour | `black` | `lightgrey` |
| `--border-accent` | Softer border for editors and cards | `rgba(0, 0, 0, 0.4)` | `rgba(255, 255, 255, 0.4)` |
| `--border-light` | Faint border for cards | `rgba(0, 0, 0, 0.2)` | `rgba(0, 0, 0, 0.2)` |
| `--unselected-tab` | Background of inactive tabs | `#b3b9c4` | `grey` |
| `--error` | Error text | `#da0000` | `#dc5c5c` |
| `--error-bg` | Error and login prompt background | `#ffa9a9` | `#231010` |
| `--warning` | Warning text and borders | `#883` | `#967f46` |
| `--mod` | Title colour of pinned refs | `#136500` | `#4d9339` |
| `--card` | Card background (kanban, todo, chat, notes, ...) | `#f3ebc7` | `#3d3d3d` |
| `--card-dragging` | Card background while dragging | `#ede7dc` | `#4d4d4d` |
| `--placeholder` | Drop placeholder background | `#efebdf` | `#2c2c2c` |
| `--deleting` | Background of items about to be deleted | `#ffa9a9` | `#dc5c5c` |
| `--quote` | Blockquote border in markdown | `#af5800` | `#969696` |

The list lives in `src/app/util/theme.ts` (`THEME_VARS`). Keep it in sync with this table when you
add a variable.

## Class reference

Quick lookup of the reusable classes defined in `src/theme/*.scss`.

### Page state (on `<body>` or `<app-root>`)

| Selector | Meaning |
|---|---|
| `.init-theme`, `.light-theme`, `.dark-theme` | Startup splash, then the active colour scheme |
| `.hotkey` | Hotkey modifier is held |
| `.fullscreen` | An editor is fullscreen |
| `.darwin`, `.ios`, `.safari`, `.android`, `.electron` | Platform |
| `.debug` | Running with a debug login |

### Row state and modifiers

| Selector | Meaning |
|---|---|
| `.editing` | Edit form is open |
| `.deleted` | Entity was just deleted |
| `.last-selected` | Last row you opened, when you come back to a list |
| `.pinned` | Pinned ref at the top of a list |
| `.full-page` | The main ref on a ref page |
| `.parent-ref` | Parent ref shown above a ref page |
| `.thread` | Ref page in thread view |
| `.upload`, `.exists`, `.outdated` | Row on the upload page: pending upload, already on the server, or upload conflicted |
| `.sent` | Ref authored by the current user |
| `.plugin_<tag>` | Ref has that plugin, e.g. `.plugin_comment` for `plugin/comment` (`+`/`_` removed, `/` → `_`, `.` → `-`). Plugin and Template rows get the same class for their own tag. |
| `.response-<tag>` | Ref has responses with that plugin, same escaping as above |

### Inside rows

| Selector | Meaning |
|---|---|
| `.host` | Domain after the title in `.link` |
| `a.tag`, `a.user.tag`, `a.origin.tag` | Inline tag, user and origin links |
| `.icon` | Emoji icon in `.info` |
| `.new-resp` | "(N new)" counter in `.actions` |
| `.action` | One action in `.actions` |
| `.fake-link` | Clickable `<a>` or `<span>` styled like a link |
| `.toggle` | Expand/collapse button beside a row (`.toggle-x`, `.toggle-plus`, `.toggle-fullscreen`) |
| `.viewer-inline`, `.viewer-below` | Expanded embed, inline or under the row |
| `.expand`, `.image-expand`, `.embed-expand`, `.video-expand`, `.audio-expand`, `.lens-expand` | Expanded content by type |
| `.voting`, `.vote-up`, `.vote-down` | Vote arrows on refs |

### Lists and pages

| Selector | Meaning |
|---|---|
| `.ref-list`, `.ext-list`, `.plugin-list`, `.template-list`, `.user-list` | Entity lists |
| `.list-container` | Generic list wrapper |
| `.page-controls` | Pagination and page size |
| `.load-more`, `.no-results` | Footer of a list |
| `.tabs`, `.current-tab` | Page tabs |
| `.sidebar` | Right sidebar |
| `.subscription-bar` | Top bar of subscriptions and bookmarks |
| `.md` | Rendered markdown |
| `.comment`, `.comment-thread` | Comment plugin view |

### Forms and popups

| Selector | Meaning |
|---|---|
| `.form`, `.full-page-form` | Edit form on a row, full page submit form |
| `.form-group`, `.form-array`, `.field` | Form layout and a single field |
| `.buttons`, `.controls` | Button rows in forms |
| `.plugins-form` | Plugin fields in a form |
| `.editor` | Markdown editor |
| `.bubble` | Rounded panel (inline plugins, default sort and filter) |
| `.popup`, `.context-menu`, `.login-popup` | Floating panels |
| `.advanced-actions` | The "more" actions menu |
| `details.advanced`, `details.mini` | Collapsible sections |
| `.submit-button` | Big call-to-action button (e.g. Submit in the sidebar) |
| `.error`, `.warning` | Validation messages |

### Utilities

| Selector | Effect |
|---|---|
| `.row`, `.col`, `.stack` | Flex row, column, and vertical stack |
| `.grow`, `.spacer` | Fill the remaining space |
| `.nowrap`, `.no-select`, `.no-underline`, `.no-margin`, `.wide`, `.padded` | Common tweaks |
| `.dn` | `display: none` |
| `.hidden-without-removing` | Invisible but still in the layout |
| `.loading`, `.loading-dots` | Loading indicators |
| `.print-hide`, `.print-block`, `.print-inline` | Hide or show when printing |

## Known quirks

- Refs nest line 2 deeper than the other rows (inside `.row > .stack > .link-below > .stack`).
- Plugin views such as comment, blog, chat, kanban and note render refs in their own layouts,
  not as `.ref` rows.
- Targeting descendants without child selectors like `>` might target more than you expect if
  there is a lot of recursive embedding.
