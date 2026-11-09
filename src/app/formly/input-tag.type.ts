import { afterNextRender, Component, computed, DestroyRef, inject, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { uniq, uniqBy } from 'lodash-es';
import { catchError, debounceTime, forkJoin, map, of, Subject, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { ExtService } from '../service/api/ext.service';
import { AuthzService } from '../service/authz.service';
import { EditorService } from '../service/editor.service';
import {
  filterInputTag,
  hierarchicalTagTemplate,
  inputTagDefaults,
  InputTagPart,
  inputTagPattern,
  inputTagQuery,
  inputTagSuggestion,
  inputTagValues,
  parseInputTag,
  partialInputTag,
  resolveInputTag
} from '../util/input-tag';

/**
 * Fill out a tag from the template in `props.template`, such as
 * `+plugin,_plugin/secret/<Name>` or `car/<Year>/<Make>`.
 * The value is the tag once every input is filled out. Until then it is
 * the known prefix, which the `inputTag` validator rejects.
 *
 * With `props.hierarchical` the field shows its own label and only the
 * inputs below its parent: the sibling field `props.parentKey` with the
 * template `props.parentTemplate`. It is disabled until the parent is
 * filled out, cleared when the parent changes, and empty until filled out.
 */
@Component({
  selector: 'formly-field-input-tag',
  host: { 'class': 'field input-tag-field' },
  template: `
    @if (hierarchical()) {
      <label class="form-label hierarchical-tag-label" [attr.for]="id" [class.required]="props.required">{{ label() }}:</label>
    }
    <div class="input-tag" [class.hierarchical-tag]="hierarchical()">
      @for (p of parts(); track $index; let i = $index) {
        @if (i > firstVisible()) {
          <span class="separator">/</span>
        }
        @if (!visible()[i]) {
          <!-- Shown in the label -->
        } @else if (!p.options) {
          <input class="preview tag-input-preview"
                 type="text"
                 tabindex="-1"
                 [value]="placeholderNames()[i]"
                 [title]="placeholderTags()[i]"
                 [style.display]="placeholderNames()[i] ? 'block' : 'none'"
                 (focus)="edit(i, input)">
          <input #input
                 class="tag-input"
                 type="text"
                 inputmode="email"
                 enterkeyhint="next"
                 autocorrect="off"
                 autocapitalize="none"
                 autocomplete="off"
                 required
                 [attr.id]="i === firstControl() ? id : null"
                 [attr.list]="listId"
                 [attr.pattern]="patterns()[i]"
                 [placeholder]="p.label"
                 [attr.aria-label]="p.label || null"
                 [value]="values()[i]"
                 [disabled]="disabled()"
                 [class.hidden-without-removing]="placeholderNames()[i]"
                 (focus)="edit(i, input); search(i)"
                 (blur)="blur()"
                 (input)="setValue(i, $any($event.target).value); search(i)">
        } @else if (p.options.length === 1) {
          <span class="tag-preview" [title]="p.options[0]">{{ labels()[i][0] }}</span>
        } @else {
          <select class="tag-choice"
                  [disabled]="disabled()"
                  [attr.id]="i === firstControl() ? id : null"
                  (change)="setValue(i, $any($event.target).value)">
            @for (o of p.options; track o; let j = $index) {
              <option [value]="o" [title]="o" [selected]="values()[i] === o">{{ labels()[i][j] }}</option>
            }
          </select>
        }
      }
    </div>
    <datalist [id]="listId">
      @for (o of autocomplete(); track o.value) {
        <option [value]="o.value">{{ o.label }}</option>
      }
    </datalist>
  `,
  styles: `
    :host {
      display: contents;
    }

    .hierarchical-tag-label {
      white-space: nowrap;
    }

    .input-tag {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;

      .tag-input, .tag-input-preview {
        flex: 1 1 80px;
        min-width: 80px;
      }
    }
  `,
})
export class FormlyFieldInputTag extends FieldType<FieldTypeConfig> {
  private exts = inject(ExtService);
  private auth = inject(AuthzService);
  private editor = inject(EditorService);
  private destroyRef = inject(DestroyRef);

  readonly listId = 'input-tag-' + uuid();
  readonly template = computed(() => this.props.template as string || '');
  readonly hierarchical = computed(() => !!this.props.hierarchical);
  readonly parentTemplate = computed(() => this.props.parentTemplate as string | undefined);
  readonly parentTag = signal<string | null>(null);
  /**
   * The template with the parent filled in, or empty until the parent is filled out.
   */
  readonly filledTemplate = computed(() => hierarchicalTagTemplate(this.template(), this.parentTemplate(), this.parentTag()));
  readonly disabled = computed(() => !this.filledTemplate());
  readonly parts = computed(() => filterInputTag(parseInputTag(this.filledTemplate() || this.template()), t => this.auth.canAddTag(t)));
  readonly values = linkedSignal<InputTagPart[], string[]>({
    source: this.parts,
    computation: (parts, previous) => previous
      ? inputTagDefaults(parts)
      : inputTagValues(parts, untracked(() => this.formControl.value)),
  });
  readonly patterns = computed(() => this.parts().map(p => p.options ? null : inputTagPattern(p).source.slice(1, -1)));
  /**
   * The fixed tag shown in the label of a hierarchical field instead of the inputs.
   */
  readonly leading = computed(() => {
    if (!this.hierarchical()) return '';
    const first = parseInputTag(this.template())[0];
    return first.options?.length === 1 ? first.options[0] : '';
  });
  /**
   * Hierarchical fields only show the parts below the parent or the leading fixed tag.
   */
  readonly visible = computed(() => {
    const parts = this.parts();
    if (!this.hierarchical()) return parts.map(() => true);
    const parent = this.parentTemplate();
    const depth = parent
      ? (this.filledTemplate() ? this.parentTag()! : parent).split('/').filter(s => s).length
      : this.leading() ? parts[1]?.depth ?? 0 : 0;
    return parts.map(p => p.depth >= depth);
  });
  readonly firstVisible = computed(() => this.visible().indexOf(true));
  readonly firstControl = computed(() => this.parts().findIndex((p, i) => this.visible()[i] && (!p.options || p.options.length > 1)));
  readonly autocomplete = signal<{ value: string, label: string }[]>([]);
  readonly editing = signal(-1);

  private readonly previews = rxResource({
    params: () => uniq([...this.parts().flatMap(p => p.options || []), ...this.leading() ? [this.leading()] : []]),
    stream: ({ params }) => this.editor.getTagsPreview(params).pipe(
      map(xs => new Map(xs.map(x => [x.tag, x.name || x.tag]))),
      catchError(() => of(new Map<string, string>())),
    ),
  });

  /**
   * The preview name of each fixed option. Options with the same name also show their tag.
   */
  readonly labels = computed(() => {
    const names = this.previews.hasValue() ? this.previews.value() : new Map<string, string>();
    return this.parts().map(p => {
      const labels = (p.options || []).map(o => names.get(o) || o);
      return labels.map((l, i) => labels.indexOf(l) === labels.lastIndexOf(l) ? l : l + ' (' + p.options![i] + ')');
    });
  });

  readonly label = computed(() => {
    const names = this.previews.hasValue() ? this.previews.value() : new Map<string, string>();
    const leading = this.leading();
    return [
      leading && (names.get(leading) || leading),
      ...this.parts().filter((p, i) => this.visible()[i] && !p.options).map(p => p.label),
    ].filter(l => l).join(' ');
  });

  /**
   * The tag filled out up to each placeholder, unless it is being edited.
   */
  readonly placeholderTags = computed(() => {
    const parts = this.parts();
    const values = this.values();
    const editing = this.editing();
    return parts.map((p, i) => {
      if (p.options || i === editing) return '';
      return resolveInputTag(parts.slice(0, i + 1), values.slice(0, i + 1));
    });
  });

  private readonly placeholderPreviews = rxResource({
    params: () => uniq(this.placeholderTags().filter(t => t)),
    stream: ({ params }) => params.length ? forkJoin(params.map(t => this.exts.getCachedExt(t).pipe(
      map(x => [t, x.modified && x.name || ''] as const),
      catchError(() => of([t, ''] as const)),
    ))).pipe(map(xs => new Map(xs))) : of(new Map<string, string>()),
  });

  /**
   * The Ext name shown in place of each placeholder input while it is not being edited.
   */
  readonly placeholderNames = computed(() => {
    const names = this.placeholderPreviews.hasValue() ? this.placeholderPreviews.value() : new Map<string, string>();
    return this.placeholderTags().map(t => t && names.get(t) || '');
  });

  private readonly search$ = new Subject<number>();

  private readonly initializeView = afterNextRender(() => {
    const parent = this.props.parentKey ? this.form.get(this.props.parentKey as string) : null;
    if (parent) {
      this.parentTag.set(parent.value);
      parent.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(value => {
        this.parentTag.set(value);
        this.updateControl();
      });
    }
    // An optional field keeps its value until it is edited
    if (parent || this.props.required) this.updateControl();
  });

  constructor() {
    super();
    this.search$.pipe(
      debounceTime(200),
      switchMap(index => {
        const parts = this.parts();
        const values = this.values();
        const part = parts[index];
        const value = values[index] || '';
        let query = inputTagQuery(parts, values, index);
        let search = value;
        if (part.rest && value.includes('/')) {
          // Search below the levels already typed out
          const parent = value.substring(0, value.lastIndexOf('/'));
          search = value.substring(parent.length + 1);
          if (inputTagPattern(part).test(parent) && (query || '').split('/').length === part.depth) {
            query = query ? query + '/' + parent : parent;
          }
        }
        return this.exts.page({
          query,
          search: search || undefined,
          sort: ['tag:len', 'tag'],
          size: 100,
        }).pipe(
          map(page => page.content.flatMap(x => {
            const suggestion = inputTagSuggestion(parts, values, index, x.tag);
            if (!suggestion) return [];
            const depth = part.depth + suggestion.split('/').length;
            if (!this.auth.canAddTag(x.tag.split('/').slice(0, depth).join('/'))) return [];
            const own = x.tag.split('/').length === depth;
            return [{ value: suggestion, label: own && x.name || suggestion }];
          })),
          catchError(() => of([])),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(xs => this.autocomplete.set(uniqBy(xs, 'value')));
    this.destroyRef.onDestroy(() => this.search$.complete());
  }

  edit(index: number, input: HTMLInputElement) {
    this.editing.set(index);
    input.focus();
  }

  blur() {
    this.editing.set(-1);
    this.formControl.markAsTouched();
  }

  search(index: number) {
    this.autocomplete.set([]);
    this.search$.next(index);
  }

  setValue(index: number, value: string) {
    this.values.update(values => values.map((v, i) => i === index ? value : v));
    this.updateControl();
  }

  private updateControl() {
    const blank = !this.props.required && this.parts().every((p, i) => p.options || !this.values()[i]);
    const tag = (blank ? null : this.parentTemplate()
      ? this.filledTemplate() && resolveInputTag(this.parts(), this.values())
      : partialInputTag(this.parts(), this.values())) || null;
    if (tag !== this.formControl.value) this.formControl.setValue(tag);
  }
}
