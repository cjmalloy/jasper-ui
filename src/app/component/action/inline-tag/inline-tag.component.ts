import { Component, Input } from '@angular/core';
import { debounce } from 'lodash-es';
import { catchError, Observable, of, Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Config } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { Store } from '../../../store/store';
import { TAGS_REGEX } from '../../../util/format';
import { ActionComponent } from '../action.component';

@Component({
  standalone: false,
  selector: 'app-inline-tag',
  templateUrl: './inline-tag.component.html',
  styleUrls: ['./inline-tag.component.scss'],
  host: {'class': 'action'}
})
export class InlineTagComponent extends ActionComponent {
  tagRegex = TAGS_REGEX.source;

  @Input()
  action: (tag: string) => Observable<any|never> = () => of(null);

  editing = false;
  acting = false;
  id = uuid();
  autocomplete: { value: string; label: string }[] = [];

  private searching?: Subscription;

  constructor(
    private store: Store,
    private admin: AdminService,
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

  search = debounce((input: HTMLInputElement) => {
    const value = input.value = input.value.toLowerCase();
    const toEntry = (p: Config) => ({ value: p.tag, label: p.name || p.tag });
    const getPlugins = (text: string) => this.admin.searchPlugins(text).slice(0, 1).map(toEntry);
    const getTemplates = (text: string) => this.admin.searchTemplates(text).slice(0, 1).map(toEntry);
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: this.store.account.origin || '@',
      search: value,
      size: 1,
    }).subscribe(page => {
      this.autocomplete = page.content.map(x => ({ value: x.tag, label: x.name || x.tag }));
      if (this.autocomplete.length < 1) this.autocomplete.push(...getPlugins(value));
      if (this.autocomplete.length < 1) this.autocomplete.push(...getTemplates(value));
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
