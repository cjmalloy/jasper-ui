import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { debounce } from 'lodash-es';
import { catchError, forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { Config } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { TAGS_REGEX } from '../../../util/format';
import { hasTag } from '../../../util/tag';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-tag',
  templateUrl: './inline-tag.component.html',
  styleUrls: ['./inline-tag.component.scss'],
  host: { 'class': 'action' },
  imports: [ReactiveFormsModule, AutofocusDirective, LoadingComponent]
})
export class InlineTagComponent extends ActionComponent {
  tagsRegex = TAGS_REGEX.source;

  @Input()
  action: (tag: string) => Observable<any|never> = () => of(null);

  @Input()
  tags: string[] = [];

  editing = false;
  acting = false;
  id = 'tag-' + uuid();
  autocomplete: { value: string; label: string }[] = [];

  private searching?: Subscription;

  constructor(
    private store: Store,
    private admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
  ) {
    super();
  }


  override reset() {
    this.editing = false;
    this.acting = false;
  }

  override active() {
    return this.editing || this.acting;
  }

  save(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      field.setCustomValidity($localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`)
      field.reportValidity();
      return;
    }
    this.editing = false;
    this.acting = true;
    this.action((field.value || '').toLowerCase().trim()).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.editor.getTagPreview(value, this.store.account.origin, false,);
  }

  search = debounce((input: HTMLInputElement) => {
    const text = input.value.replace(/[,\s]+$/, '');
    const parts = text.split(/[,\s]+/).filter(t => !!t);
    const value = parts.pop() || '';
    const prefix = text.substring(0, text.length - value.length);
    const remove = value.startsWith('-') ? '-' : '';
    const tag = value.replace(/[^_+a-z0-9./]/, '').toLowerCase();
    const toEntry = (p: Config) => ({ value: prefix + remove + p.tag, label: remove + (p.name || '#' + p.tag) });
    const getPlugins = (text: string) => this.admin.searchPlugins(text).filter(p => !hasTag(p.tag, this.tags)).slice(0, 1).map(toEntry);
    const getTemplates = (text: string) => this.admin.searchTemplates(text).filter(p => !hasTag(p.tag, this.tags)).slice(0, 1).map(toEntry);
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      search: tag,
      sort: ['origin:len', 'tag:len'],
      size: 3,
    }).pipe(
      switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
      map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
      map(xs => remove ? xs.filter(x => hasTag(x.tag, this.tags)) : xs.filter(x => !hasTag(x.tag, this.tags))),
    ).subscribe(xs => {
      this.autocomplete = xs.map(x => ({ value: prefix + remove + x.tag, label: remove + (x.name || '#' + x.tag) }));
      if (!remove && this.autocomplete.length < 3) this.autocomplete.push(...getPlugins(tag));
      if (!remove && this.autocomplete.length < 3) this.autocomplete.push(...getTemplates(tag));
    });
  }, 400);

  keydown(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key === 'Enter') {
      this.save(input)
    }
    if (event.key === 'Tab' && this.autocomplete.length) {
      input.value = this.autocomplete[0].value;
      event.preventDefault();
    }
  }
}
