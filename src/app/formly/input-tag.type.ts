import { afterNextRender, Component, computed, DestroyRef, inject, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TouchedChangeEvent } from '@angular/forms';
import { FieldType, FieldTypeConfig } from '@ngx-formly/core';
import { uniqBy } from 'lodash-es';
import { catchError, debounceTime, filter, map, of, Subject, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { ExtService } from '../service/api/ext.service';
import { AuthzService } from '../service/authz.service';
import { EditorService } from '../service/editor.service';
import {
  filterInputTag,
  inputTagPattern,
  inputTagQuery,
  inputTagSuggestion,
  inputTagValues,
  parseInputTag,
  partialInputTag
} from '../util/input-tag';

/**
 * Fill out a tag from the template in `props.template`, such as
 * `+plugin,_plugin/secret/<Name>` or `car/<Year>/<Make>`.
 * The value is the tag once every input is filled out. Until then it is
 * the known prefix, which the `inputTag` validator rejects.
 */
@Component({
  selector: 'formly-field-input-tag',
  host: { 'class': 'field input-tag-field' },
  template: `
    <div class="input-tag" [class.touched]="touched()">
      @for (p of parts(); track $index; let i = $index; let first = $first) {
        @if (!first) {
          <span class="separator">/</span>
        }
        @if (!p.options) {
          <input class="tag-input"
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
                 (focus)="search(i)"
                 (blur)="formControl.markAsTouched()"
                 (input)="setValue(i, $any($event.target).value); search(i)">
        } @else if (p.options.length === 1) {
          <span class="tag-preview" [title]="p.options[0]">{{ labels()[i][0] }}</span>
        } @else {
          <select class="tag-choice"
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

    .input-tag {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;

      .tag-input {
        flex: 1 1 80px;
        min-width: 80px;
      }

      .tag-input:user-invalid, &.touched .tag-input:invalid {
        outline: 1px solid var(--error);
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
  readonly parts = computed(() => filterInputTag(parseInputTag(this.template()), t => this.auth.canAddTag(t)));
  readonly values = linkedSignal(() => inputTagValues(this.parts(), untracked(() => this.formControl.value)));
  readonly patterns = computed(() => this.parts().map(p => p.options ? null : inputTagPattern(p).source.slice(1, -1)));
  readonly firstControl = computed(() => this.parts().findIndex(p => !p.options || p.options.length > 1));
  readonly touched = signal(false);
  readonly autocomplete = signal<{ value: string, label: string }[]>([]);

  private readonly previews = rxResource({
    params: () => this.parts().flatMap(p => p.options || []),
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

  private readonly search$ = new Subject<number>();

  private readonly initializeView = afterNextRender(() => {
    this.updateControl();
    this.formControl.events.pipe(
      filter(e => e instanceof TouchedChangeEvent),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(e => this.touched.set((e as TouchedChangeEvent).touched));
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

  search(index: number) {
    this.autocomplete.set([]);
    this.search$.next(index);
  }

  setValue(index: number, value: string) {
    this.values.update(values => values.map((v, i) => i === index ? value : v));
    this.updateControl();
  }

  private updateControl() {
    const tag = partialInputTag(this.parts(), this.values()) || null;
    if (tag !== this.formControl.value) this.formControl.setValue(tag);
  }
}
