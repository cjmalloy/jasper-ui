# Theming Jasper: Row Structure

Jasper is mostly a shell around user content, so a custom theme can restyle almost everything
with plain CSS. Every entity row is either a **ref** or a **tag** (ext, plugin, template, user),
and both use the same slots: `.thumbnail?` → `.link` (line 1) → `.info` (line 2) → `.actions`.

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

<!-- Tag (kind class: ext | plugin | template | profile) -->
<app-ext class="tag ext list-item">
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
| `.ref` / `.tag.list-item` | Any ref row / any tag row |
| `.tag.ext`, `.tag.plugin`, `.tag.template`, `.tag.profile` | A specific tag kind |
| `.list-item` | Any entity row |
| `.thumbnail`, `.link`, `.info`, `.actions` | Row slots |
| `.editing` | Row with the edit form open |
| `a.tag` | Inline tag chips (not rows) |

Always select tag rows with `.tag.list-item` or a kind class, never a bare `.tag`, which also
matches inline chips.

## Example theme snippets

```css
/* Hide all thumbnails */
.ref .thumbnail { display: none; }

/* Quieter metadata line */
.list-item .info { font-size: 85%; opacity: 0.7; }

/* Tint ext rows */
.tag.ext { border-left: 3px solid teal; }

/* Highlight rows being edited */
.list-item.editing { outline: 2px dashed orange; }
```

## Known quirks

- Refs nest line 2 deeper than tags (inside `.row > .stack > .link-below > .stack`).
- Plugin views such as comment, blog, chat, kanban and note render refs in their own layouts,
  not as `.ref` rows.
