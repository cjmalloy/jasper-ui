import { afterNextRender, afterRenderEffect, Component, computed, ElementRef, inject, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FieldType, FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { isEqual, uniq, uniqBy } from 'lodash-es';
import { catchError, forkJoin, map, of, switchMap, timer } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { ExtService } from '../service/api/ext.service';
import { AuthzService } from '../service/authz.service';
import { EditorService } from '../service/editor.service';
import {
  filterInputTag,
  InputTagPart,
  inputTagLines,
  inputTagLineTags,
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

type Suggestion = { value: string, label: string, tag: string };

/**
 * Fill out a tag from the template in `props.template`, such as
 * `+plugin,_plugin/secret/<Name>` or `car/<Year>/<Make>`.
 * The value is the tag once every input is filled out. Until then it is
 * the known prefix, which the `stencil` validator rejects.
 *
 * With `props.hierarchical` each placeholder gets its own labelled line,
 * which is disabled until the lines above it are filled out and cleared
 * when they change. The value is the tag filled out up to the end of each
 * line. It shows its own labels, so it never uses a wrapper.
 */
@Component({
  selector: 'formly-field-stencil',
  host: { 'class': 'field stencil-field' },
  template: `
    @for (line of lines(); track $index; let l = $index) {
      @if (hierarchical()) {
        <label class="form-label hierarchical-tag-label" [attr.for]="lineIds()[l]" [class.required]="props.required">{{ lineLabels()[l] }}:</label>
      }
      <div class="stencil" [class.hierarchical-tag]="hierarchical()">
        @for (i of line; track i; let first = $first) {
          @let p = parts()[i];
          @if (!first) {
            <span class="separator">/</span>
          }
          @if (!p.options) {
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
                   [attr.id]="ids()[i]"
                   [attr.list]="listId"
                   [attr.data-part]="i"
                   [placeholder]="p.label"
                   [attr.aria-label]="p.label || null"
                   [value]="values()[i]"
                   [disabled]="disabledLines()[l]"
                   [class.hidden-without-removing]="placeholderNames()[i]"
                   (focus)="edit(i, input)"
                   (blur)="blur(i, input); validate(i, input)"
                   (keydown.enter)="$event.preventDefault(); commit(i, input)"
                   (input)="type(i, input, $event)">
          } @else if (p.options.length === 1) {
            <span class="tag-preview" [title]="p.options[0]">{{ labels()[i][0] }}</span>
          } @else {
            <select class="tag-choice"
                    [attr.id]="ids()[i]"
                    [disabled]="disabledLines()[l]"
                    (change)="setValue(i, $any($event.target).value)">
              @for (o of p.options; track o; let j = $index) {
                <option [value]="o" [title]="o" [selected]="values()[i] === o">{{ labels()[i][j] }}</option>
              }
            </select>
          }
        }
      </div>
    }
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
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private reported = -1;

  prePopulate(field: FormlyFieldConfig) {
    if (field.props?.hierarchical) field.wrappers = [];
  }

  readonly listId = 'stencil-' + uuid();
  readonly template = computed(() => this.props.template as string || '');
  readonly hierarchical = computed(() => !!this.props.hierarchical);
  readonly parts = computed(() => filterInputTag(parseInputTag(this.template()), t => this.auth.canAddTag(t)));
  readonly values = linkedSignal<InputTagPart[], string[]>({
    source: this.parts,
    computation: (parts, previous) => {
      if (previous) return inputTagValues(parts);
      const value = untracked(() => this.formControl.value);
      return inputTagValues(parts, Array.isArray(value) ? value.filter(t => t).at(-1) : value);
    },
  });
  /**
   * The fixed tag shown in the labels of a hierarchical field instead of the inputs.
   */
  readonly leading = computed(() => {
    const first = this.parts()[0];
    return this.hierarchical() && first.options?.length === 1 ? first.options[0] : '';
  });
  /**
   * The index of the last part of each line. A field that is not hierarchical has one line.
   */
  readonly lineEnds = computed(() => this.hierarchical() ? inputTagLines(this.parts()) : [this.parts().length - 1]);
  /**
   * The parts shown on each line.
   */
  readonly lines = computed(() => this.lineEnds().map((end, l) => {
    const start = l ? this.lineEnds()[l - 1] + 1 : this.leading() ? 1 : 0;
    return this.parts().map((_, i) => i).slice(start, end + 1);
  }));
  readonly lineIds = computed(() => this.lineEnds().map((_, l) => l ? this.id + '-' + l : this.id));
  /**
   * The first control on each line has the id its label is for.
   */
  readonly ids = computed(() => {
    const parts = this.parts();
    const ids = parts.map(() => null as string | null);
    this.lines().forEach((line, l) => {
      const i = line.find(i => !parts[i].options || parts[i].options.length > 1);
      if (i !== undefined) ids[i] = this.lineIds()[l];
    });
    return ids;
  });
  readonly disabledLines = computed(() => this.lineEnds().map((_, l) => l > 0 && !resolveInputTag(this.parts().slice(0, this.lineEnds()[l - 1] + 1), this.values())));
  readonly editing = signal(-1);
  /**
   * The values in the tag, which typing does not change until it is committed.
   */
  private committed: string[] = [];

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

  readonly lineLabels = computed(() => {
    const names = this.previews.hasValue() ? this.previews.value() : new Map<string, string>();
    const leading = this.leading();
    return this.lines().map(line => [
      leading && (names.get(leading) || leading),
      ...line.map(i => this.parts()[i].label),
    ].filter(l => l).join(' '));
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

  /**
   * Autocomplete for the input being edited, with the tag that suggested each value.
   */
  private readonly suggestions = rxResource({
    params: () => this.editing() < 0 ? undefined : { index: this.editing(), parts: this.parts(), values: this.values() },
    stream: ({ params: { index, parts, values } }) => timer(200).pipe(
      switchMap(() => {
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
        });
      }),
      map(page => page.content.flatMap(x => {
        const part = parts[index];
        const suggestion = inputTagSuggestion(parts, values, index, x.tag);
        if (!suggestion) return [];
        const depth = part.depth + suggestion.split('/').length;
        if (!this.auth.canAddTag(x.tag.split('/').slice(0, depth).join('/'))) return [];
        const own = x.tag.split('/').length === depth;
        if (!part.rest && !own && this.auth.canAddTag(x.tag)) {
          // Suggest the whole tag when it fills the following inputs
          const rest = x.tag.split('/').slice(part.depth).join('/');
          const spread = spreadInputTag(parts, values, index, rest);
          if (spread && spread.overflow === undefined) return [{ value: rest, label: x.name || rest, tag: x.tag }];
        }
        return [{ value: suggestion, label: own && x.name || suggestion, tag: x.tag }];
      })),
      catchError(() => of([])),
    ),
  });

  /**
   * Keeps the last suggestions for the input while loading, so the datalist does not flash.
   */
  private readonly lastSuggestions = linkedSignal<{ index: number, xs?: Suggestion[] }, Suggestion[]>({
    source: () => ({ index: this.editing(), xs: this.suggestions.hasValue() ? this.suggestions.value() : undefined }),
    computation: ({ index, xs }, previous) => xs || (previous?.source.index === index ? previous.value : []),
  });

  readonly autocomplete = computed(() => uniqBy(this.lastSuggestions(), 'value')
    .map(({ value, label }) => ({ value, label })));

  /**
   * The tags each autocomplete value was suggested by.
   */
  private readonly suggestedTags = computed(() => {
    const tags = new Map<string, string[]>();
    for (const x of this.lastSuggestions()) tags.set(x.value, [...tags.get(x.value) || [], x.tag]);
    return tags;
  });

  // Sync the validation message of each input
  private readonly validity = afterRenderEffect(() => {
    const values = this.values();
    for (const input of this.el.nativeElement.querySelectorAll<HTMLInputElement>('input.tag-input[data-part]')) {
      const index = Number(input.dataset['part']);
      input.setCustomValidity(this.invalidMessage(index, values[index] || ''));
    }
  });

  private readonly initializeView = afterNextRender(() => {
    this.committed = this.values();
    // An optional field keeps its value until it is edited
    if (this.props.required) this.updateControl();
  });

  edit(index: number, input: HTMLInputElement) {
    this.editing.set(index);
    input.focus();
  }

  blur(index: number, input: HTMLInputElement) {
    this.commit(index, input);
    this.editing.set(-1);
    this.formControl.markAsTouched();
  }

  /**
   * Report an invalid input once, so leaving it again moves on like the tag input.
   */
  validate(index: number, input: HTMLInputElement) {
    const message = this.invalidMessage(index, this.values()[index] || '');
    if (!message || this.reported === index) {
      this.reported = -1;
      return;
    }
    this.reported = index;
    input.setCustomValidity(message);
    input.reportValidity();
  }

  /**
   * Typing or pasting only changes this input. Picking from the autocomplete
   * also fills the inputs around it.
   */
  type(index: number, input: HTMLInputElement, event?: Event) {
    if (event instanceof InputEvent && event.inputType !== 'insertReplacementText') {
      // The tag is updated once committed
      this.values.update(values => values.map((v, i) => i === index ? input.value : v));
    } else {
      this.fillBefore(index, input.value);
      this.commit(index, input);
    }
  }

  /**
   * Update the tag with the text typed into an input, spreading slashes over the following inputs.
   */
  commit(index: number, input: HTMLInputElement) {
    const spread = spreadInputTag(this.parts(), this.values(), index, input.value);
    if (spread && spread.overflow === undefined) {
      this.setValues(spread.values, spread.last);
    } else {
      this.setValue(index, input.value);
    }
    input.value = this.values()[index];
  }

  /**
   * Fill out the blank inputs before an index from the tags that suggested
   * the value picked from the autocomplete, when they all agree.
   */
  private fillBefore(index: number, value: string) {
    const tags = this.suggestedTags().get(value);
    if (!tags?.length) return;
    const parts = this.parts();
    const candidates = tags.map(t => inputTagValues(parts, t));
    this.setValues(this.values().map((v, i) => {
      if (i >= index || v || parts[i].options) return v;
      const filled = uniq(candidates.map(c => c[i]));
      return filled.length === 1 ? filled[0] : v;
    }), index);
  }

  /**
   * Why the value typed into the placeholder at an index is invalid, or an empty string.
   */
  invalidMessage(index: number, value: string) {
    const part = this.parts()[index];
    if (!value || validInputTagValue(value, part)) return '';
    if (value.includes('/') && !part.rest) {
      // Fills the following inputs once committed
      const spread = spreadInputTag(this.parts(), this.values(), index, value);
      return spread && spread.overflow === undefined ? '' : $localize`Does not fit the tag ${this.template()}`;
    }
    if (part.rest) return $localize`Must be lower case letters, numbers, periods and forward slashes.`;
    return $localize`Must be lower case letters, numbers and periods.`;
  }

  setValue(index: number, value: string) {
    this.setValues(this.values().map((v, i) => i === index ? value : v), index);
  }

  /**
   * Set the values changed up to an index and update the tag.
   * A hierarchical field clears the inputs after it when they change.
   */
  private setValues(values: string[], last: number) {
    const changed = values.findIndex((v, i) => v !== this.committed[i]);
    if (this.hierarchical() && changed >= 0 && changed <= last) {
      values = values.map((v, i) => i > last && !this.parts()[i].options ? '' : v);
    }
    this.committed = values;
    this.values.set(values);
    this.updateControl();
  }

  private updateControl() {
    const parts = this.parts();
    const values = this.values();
    const blank = !this.props.required && parts.every((p, i) => p.options || !values[i]);
    const value = blank ? null
      : this.hierarchical() ? inputTagLineTags(parts, values)
      : partialInputTag(parts, values) || null;
    if (!isEqual(value, this.formControl.value)) this.formControl.setValue(value);
  }
}
