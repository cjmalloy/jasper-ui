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
  <div class="row">                      <!-- layout wrapper -->
    <div class="thumbnail"></div>        <!-- optional -->
    <div class="stack">                  <!-- layout wrapper -->
      <div class="link">…</div>          <!-- line 1: title -->
      <div class="link-below">           <!-- layout wrapper (+ toggles) -->
        <div class="stack">              <!-- layout wrapper -->
          <div class="info">…</div>      <!-- line 2: metadata -->
          <div class="actions">…</div>   <!-- line 3: links / buttons -->
        </div>
      </div>
    </div>
  </div>
</app-ref>

<!-- Ext, Plugin, Template or User (root class: ext | plugin | template | profile) -->
<app-ext class="ext list-item">
  <div class="link">…</div>              <!-- line 1: title -->
  <div class="stack">                    <!-- layout wrapper -->
    <div class="info">…</div>            <!-- line 2: metadata -->
    <div class="actions">…</div>         <!-- line 3: links / buttons -->
  </div>
</app-ext>
```

## Selectors

| Selector | Matches |
|---|---|
| `.ref` | Ref rows |
| `.ext`, `.plugin`, `.template`, `.profile` | Ext, Plugin, Template and User rows |
| `.list-item` | Any entity row |
| `.thumbnail`, `.link`, `.info`, `.actions` | Row slots |
| `.editing` | Row with the edit form open |
| `.tag` | Inline tag links (not rows) |

User rows use `.profile` for the permission entity, and user tag links use `.user`.

## Class reference

Quick lookup of the reusable classes defined in `src/theme/*.scss`. Prefer CSS variables
(`--bg`, `--text`, `--border`, `--tag`, `--info`, `--active`, `--error`, `--card`, …, see the top of
`common.scss`) when you only want to change colours.

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
