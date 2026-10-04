# Theming Jasper: Row Structure

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

User rows use `.profile` because `.user` is already used on inline user tag links
(`a.user.tag`).

## Example theme snippets

```css
/* Hide all thumbnails */
.ref .thumbnail { display: none; }

/* Quieter metadata line */
.list-item .info { font-size: 85%; opacity: 0.7; }

/* Tint ext rows */
.ext.list-item { border-left: 3px solid teal; }

/* Highlight rows being edited */
.list-item.editing { outline: 2px dashed orange; }
```

## Known quirks

- Refs nest line 2 deeper than the other rows (inside `.row > .stack > .link-below > .stack`).
- Plugin views such as comment, blog, chat, kanban and note render refs in their own layouts,
  not as `.ref` rows.
