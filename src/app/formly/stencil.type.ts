import { afterNextRender, afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, linkedSignal, signal, untracked } from '@angular/core';
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
  resolveInputTag,
  spreadInputTag,
  validInputTagValue
} from '../util/input-tag';

/**
 * Fill out a tag from the template in `props.template`, such as
 * `+plugin,_plugin/secret/<Name>` or `car/<Year>/<Make>`.
 * The value is the tag once every input is filled out. Until then it is
 * the known prefix, which the `stencil` validator rejects.
 *
 * With `props.hierarchical` the field shows only the
 * inputs below its parent: the sibling field `props.parentKey` with the
 * template `props.parentTemplate`. It is disabled until the parent is
 * filled out, cleared when the parent changes, and empty until filled out.
 * Without a wrapper it also shows its own label, naming the parent.
 */
@Component({
  selector: 'formly-field-stencil',
  host: { 'class': 'field stencil-field' },
  template: `
    @if (ownLabel()) {
      <label class="form-label hierarchical-tag-label" [attr.for]="id" [class.required]="props.required">{{ label() }}:</label>
    }
    <div class="stencil" [class.hierarchical-tag]="hierarchical()">
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
                 [attr.pattern]="spread()?.index === i ? null : patterns()[i]"
                 [placeholder]="p.label"
                 [attr.aria-label]="p.label || null"
                 [value]="spread()?.index === i ? spread()!.text : values()[i]"
                 [disabled]="disabled()"
                 [class.hidden-without-removing]="placeholderNames()[i]"
                 (focus)="edit(i, input); search(i)"
                 (blur)="blur(i, input); validate(i, input)"
                 (keydown.enter)="commit(i, input)"
                 [attr.data-part]="i"
                 (input)="type(i, input, $event)">
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

    .stencil {
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
export class FormlyFieldStencil extends FieldType<FieldTypeConfig> {
  private exts = inject(ExtService);
  private auth = inject(AuthzService);
  private editor = inject(EditorService);
  private destroyRef = inject(DestroyRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly listId = 'stencil-' + uuid();
  readonly template = computed(() => this.props.template as string || '');
  readonly hierarchical = computed(() => !!this.props.hierarchical);
  /**
   * A wrapper already shows the label in the first column.
   */
  readonly ownLabel = computed(() => this.hierarchical() && !this.field.wrappers?.length);
  readonly parentTemplate = computed(() => this.props.parentTemplate as string | undefined);
  readonly parentTag = signal<string | null>(null);
  /**
   * The template with the parent filled in, or empty until the parent is filled out.
   */
  readonly filledTemplate = computed(() => hierarchicalTagTemplate(this.template(), this.parentTemplate(), this.parentTag()));
  readonly disabled = computed(() => !this.filledTemplate());
  /**
   * A hierarchical field with child fields passes extra segments on to them,
   * so its last placeholder is a single segment.
   */
  readonly hasChildren = computed(() => this.key !== undefined && !!this.field.parent?.fieldGroup?.some(f => f.props?.parentKey === this.key));
  readonly parts = computed(() => filterInputTag(parseInputTag(this.filledTemplate() || this.template()), t => this.auth.canAddTag(t))
    .map(p => p.rest && this.hasChildren() ? { ...p, rest: false } : p));
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
  /**
   * The tags each autocomplete value was suggested by.
   */
  private suggestedTags = new Map<string, string[]>();
  readonly editing = signal(-1);
  /**
   * Text typed with slashes into an input, which fills the following inputs once committed.
   */
  readonly spread = signal<{ index: number, text: string } | null>(null);

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

  // Sync the validation message of each input
  private readonly validity = afterRenderEffect(() => {
    const values = this.values();
    for (const input of this.el.nativeElement.querySelectorAll<HTMLInputElement>('input.tag-input[data-part]')) {
      const index = Number(input.dataset['part']);
      input.setCustomValidity(this.invalidMessage(index, values[index] || ''));
    }
  });

  private readonly initializeView = afterNextRender(() => {
    const parent = this.props.parentKey ? this.form.get(this.props.parentKey as string) : null;
    if (parent) {
      this.parentTag.set(parent.value);
      parent.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(value => {
        this.parentTag.set(value);
        this.updateControl();
        const overflow = this.formState.stencilOverflow;
        if (overflow?.parentKey === this.props.parentKey) {
          delete this.formState.stencilOverflow;
          this.takeOverflow(overflow.value);
        }
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
        const spread = this.spread();
        const value = (spread?.index === index ? spread.text : values[index]) || '';
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
            const result = [{ value: suggestion, label: own && x.name || suggestion, tag: x.tag }];
            if (!part.rest && !own && this.auth.canAddTag(x.tag)) {
              // Suggest the whole tag, which fills the following inputs
              const rest = x.tag.split('/').slice(part.depth).join('/');
              const spread = spreadInputTag(parts, values, index, rest);
              if (spread && (spread.overflow === undefined || this.hasChildren())) {
                result.push({ value: rest, label: x.name || rest, tag: x.tag });
              }
            }
            return result;
          })),
          catchError(() => of([])),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(xs => {
      this.suggestedTags = new Map();
      for (const x of xs) this.suggestedTags.set(x.value, [...this.suggestedTags.get(x.value) || [], x.tag]);
      this.autocomplete.set(uniqBy(xs, 'value').map(({ value, label }) => ({ value, label })));
    });
    this.destroyRef.onDestroy(() => this.search$.complete());
  }

  edit(index: number, input: HTMLInputElement) {
    this.editing.set(index);
    input.focus();
  }

  blur(index: number, input: HTMLInputElement) {
    this.commit(index, input);
    this.editing.set(-1);
    this.formControl.markAsTouched();
  }

  validate(index: number, input: HTMLInputElement) {
    const message = this.invalidMessage(index, this.values()[index] || '');
    if (!message) return;
    input.setCustomValidity(message);
    input.reportValidity();
  }

  search(index: number) {
    this.autocomplete.set([]);
    this.search$.next(index);
  }

  /**
   * Typing a `/` fills the following inputs and moves to the last one filled.
   */
  type(index: number, input: HTMLInputElement, event?: Event) {
    const typed = event instanceof InputEvent && event.inputType !== 'insertReplacementText' && event.inputType !== 'insertFromPaste';
    if (typed && input.value.includes('/') && this.spreads(index, input.value)) {
      // Keep typing in this input until it is committed
      this.spread.set({ index, text: input.value });
      this.search(index);
      return;
    }
    this.spread.set(null);
    if (!typed) this.fillBefore(index, input.value);
    if (this.fill(index, input.value)) input.value = this.values()[index];
  }

  /**
   * Fill the following inputs with the text typed with slashes into an input.
   */
  commit(index: number, input: HTMLInputElement) {
    const spread = this.spread();
    if (spread?.index !== index) return;
    this.spread.set(null);
    this.fill(index, spread.text);
    input.value = this.values()[index];
  }

  private spreads(index: number, value: string) {
    const spread = spreadInputTag(this.parts(), this.values(), index, value);
    return !!spread && (spread.overflow === undefined ? spread.last > index : this.hasChildren());
  }

  /**
   * Fill out the blank inputs before an index from the tags that suggested
   * the value picked from the autocomplete, when they all agree.
   */
  private fillBefore(index: number, value: string) {
    const tags = this.suggestedTags.get(value);
    if (!tags?.length) return;
    const parts = this.parts();
    const candidates = tags.map(t => inputTagValues(parts, t));
    const values = this.values().map((v, i) => {
      if (i >= index || v || parts[i].options) return v;
      const filled = uniq(candidates.map(c => c[i]));
      return filled.length === 1 ? filled[0] : v;
    });
    if (values.some((v, i) => v !== this.values()[i])) this.values.set(values);
  }

  /**
   * Set the value typed into the placeholder at an index, spreading it over the
   * following inputs and child fields. Returns true if it was spread.
   */
  private fill(index: number, value: string) {
    const spread = spreadInputTag(this.parts(), this.values(), index, value);
    if (!spread || spread.overflow !== undefined && !this.hasChildren()) {
      this.setValue(index, value);
      this.search(index);
      return false;
    }
    this.values.set(spread.values);
    if (spread.overflow === undefined) {
      this.updateControl();
    } else {
      this.formState.stencilOverflow = { parentKey: this.key, value: spread.overflow };
      this.updateControl(true);
    }
    this.search(index);
    return true;
  }

  /**
   * Fill out the extra segments typed into the parent field.
   */
  private takeOverflow(value: string) {
    const index = this.parts().findIndex((p, i) => this.visible()[i] && !p.options);
    if (index >= 0) this.fill(index, value);
  }


  /**
   * Why the value typed into the placeholder at an index is invalid, or an empty string.
   */
  invalidMessage(index: number, value: string) {
    const part = this.parts()[index];
    if (!value || validInputTagValue(value, part)) return '';
    if (value.includes('/') && !part.rest) return $localize`Does not fit the tag ${this.filledTemplate() || this.template()}`;
    if (part.rest) return $localize`Must be lower case letters, numbers, periods and forward slashes.`;
    return $localize`Must be lower case letters, numbers and periods.`;
  }

  setValue(index: number, value: string) {
    this.values.update(values => values.map((v, i) => i === index ? value : v));
    this.updateControl();
  }

  private updateControl(emit = false) {
    const blank = !this.props.required && this.parts().every((p, i) => p.options || !this.values()[i]);
    const tag = (blank ? null : this.parentTemplate()
      ? this.filledTemplate() && resolveInputTag(this.parts(), this.values())
      : partialInputTag(this.parts(), this.values())) || null;
    if (emit || tag !== this.formControl.value) this.formControl.setValue(tag);
  }
}
