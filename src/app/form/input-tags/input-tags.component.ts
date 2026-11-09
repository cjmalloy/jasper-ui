import { Component, computed, DestroyRef, inject, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { uniqBy } from 'lodash-es';
import { catchError, debounceTime, map, of, Subject, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { ExtService } from '../../service/api/ext.service';
import {
  inputTagDefaults,
  inputTagPlaceholders,
  inputTagQuery,
  inputTagSuggestion,
  parseInputTag,
  resolveInputTag
} from '../../util/input-tag';

type Field = { row: number, segment: number };

@Component({
  selector: 'app-input-tags',
  templateUrl: './input-tags.component.html',
  styleUrls: ['./input-tags.component.scss'],
  host: { 'class': 'field input-tags' },
})
export class InputTagsComponent {
  private exts = inject(ExtService);

  readonly templates = input<string[]>([]);
  readonly submitted = input(false);
  /**
   * The tag for each template, or an empty string until it is filled out.
   */
  readonly tagsChange = output<string[]>();

  readonly id = 'input-tag-' + uuid();
  readonly listId = this.id + '-list';
  readonly rows = computed(() => this.templates().map(t => {
    const segments = parseInputTag(t);
    const placeholders = inputTagPlaceholders(segments);
    return segments.map((s, i) => ({ ...s, placeholder: placeholders.indexOf(i) }));
  }));
  readonly values = linkedSignal(() => this.templates().map(t => inputTagDefaults(parseInputTag(t))));
  readonly autocomplete = signal<{ value: string, label: string }[]>([]);

  private readonly search$ = new Subject<Field>();

  constructor() {
    this.search$.pipe(
      debounceTime(200),
      switchMap(({ row, segment }) => {
        const segments = parseInputTag(this.templates()[row]);
        const values = this.values()[row];
        const value = values[inputTagPlaceholders(segments).indexOf(segment)];
        return this.exts.page({
          query: inputTagQuery(segments, values, segment),
          search: value || undefined,
          sort: ['tag:len', 'tag'],
          size: 100,
        }).pipe(
          map(page => page.content.flatMap(x => {
            const suggestion = inputTagSuggestion(segments, values, segment, x.tag);
            if (!suggestion) return [];
            const own = x.tag.split('/').length === segment + 1;
            return [{ value: suggestion, label: own && x.name || suggestion }];
          })),
          catchError(() => of([])),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(xs => this.autocomplete.set(uniqBy(xs, 'value')));
    inject(DestroyRef).onDestroy(() => this.search$.complete());
  }

  search(row: number, segment: number) {
    this.autocomplete.set([]);
    this.search$.next({ row, segment });
  }

  setValue(row: number, placeholder: number, value: string) {
    this.values.update(values => values.map((v, r) => r === row ? v.map((p, i) => i === placeholder ? value : p) : v));
    this.tagsChange.emit(this.rows().map((_, r) => resolveInputTag(parseInputTag(this.templates()[r]), this.values()[r])));
  }
}
