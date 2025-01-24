import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Config } from '../model/tag';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { ConfigService } from '../service/config.service';
import { Store } from '../store/store';
import { access, removePrefix } from '../util/tag';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-tag-input',
  host: {'class': 'field'},
  template: `
    <div class="form-array skip-margin">
      <input class="preview grow"
             type="text"
             [value]="preview"
             [title]="input.value"
             [style.display]="preview ? 'block' : 'none'"
             (focus)="clickPreview(input)">
      <datalist [id]="listId">
        @for (o of autocomplete; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </datalist>
      <input #input
             class="grow"
             type="text"
             inputmode="email"
             enterkeyhint="enter"
             autocorrect="off"
             autocapitalize="none"
             [attr.list]="listId"
             [class.cdk-visually-hidden]="preview"
             (input)="search(input.value)"
             cdkMonitorElementFocus
             (cdkFocusChange)="$event ? edit(input) : blur(input)"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldTagInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  listId = uuid();
  preview = '';
  editing = false;
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;

  constructor(
    private configs: ConfigService,
    private config: FormlyConfig,
    private admin: AdminService,
    private exts: ExtService,
    public store: Store,
    private cd: ChangeDetectorRef,
  ) {
    super();
  }

  ngAfterViewInit() {
    if (this.model) this.getPreview(this.model[this.key as any]);
    this.formChanges?.unsubscribe();
    this.formChanges = this.formControl.valueChanges.subscribe(value => {
      if (!this.editing && value) {
        this.getPreview(value);
      } else {
        this.preview = '';
      }
    });
  }

  ngOnDestroy() {
    this.searching?.unsubscribe();
    this.formChanges?.unsubscribe();
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity(getErrorMessage(this.field, this.config));
      input.reportValidity();
    }
  }

  blur(input: HTMLInputElement) {
    this.editing = false;
    if (this.showError && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
    }
    this.getPreview(input.value);
  }

  getPreview(value: string) {
    if (!value) return;
    if (this.showError) return;
    this.preview$(value).subscribe((x?: { name?: string, tag: string }) => {
      this.preview = x?.name || x?.tag || '';
      this.cd.detectChanges();
    });
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.exts.getCachedExt(value, this.field.props.origin).pipe(
      switchMap(x => {
        if (this.field.type !== 'plugin') {
          const templates = this.admin.getTemplates(x.tag).filter(t => t.tag);
          if (templates.length) {
            const longestMatch = templates[templates.length - 1];
            if (x.tag === longestMatch.tag) return of(longestMatch);
            return of({ tag: x.tag, name: (longestMatch.name || longestMatch.tag) + ' / ' + (x.name || x.tag) });
          }
        }
        if (x.modified && x.origin === (this.field.props.origin || this.store.account.origin)) return of(x);
        const plugin = this.admin.getPlugin(x.tag);
        if (this.field.type !== 'template') {
          if (plugin) return of(plugin);
          const parentPlugins = this.admin.getParentPlugins(x.tag);
          if (parentPlugins.length) {
            const longestMatch = parentPlugins[parentPlugins.length - 1];
            if (x.tag === longestMatch.tag) return of(longestMatch);
            const childTag = removePrefix(x.tag, longestMatch.tag.split('/').length);
            if (longestMatch.tag === 'plugin/outbox') {
              const origin = childTag.substring(0, childTag.indexOf('/'));
              const remoteTag = childTag.substring(origin.length + 1);
              const originFormat = origin ? ' @' + origin : '';
              return this.exts.getCachedExt(remoteTag, origin).pipe(
                map(c => ({ tag: x.tag, name: (longestMatch.name || longestMatch.tag) + ' / ' + (c.name || c.tag) + originFormat })),
              );
            }
            let a = access(x.tag);
            if (childTag === 'user' || childTag.startsWith('user/')) {
              a ||= '+';
            }
            return this.exts.getCachedExt(a + childTag, this.field.props.origin).pipe(
              map(c => ({ tag: x.tag, name: (longestMatch.name || longestMatch.tag) + ' / ' + c.name || c.tag })),
            );
          }
        }
        if (x.modified) return of(x);
        return of(undefined);
      })
    );
  }

  edit(input: HTMLInputElement) {
    this.editing = true;
    this.preview = '';
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      window.open(this.configs.base + 'tag/' + input.value);
    } else {
      this.edit(input);
    }
  }

  search = debounce((value: string) => {
    const toEntry = (p: Config) => ({ value: p.tag, label: p.name || p.tag });
    const getPlugins = (text: string, size = 5) => this.admin.searchPlugins(text).slice(0, size).map(toEntry);
    const getTemplates = (text: string, size = 5) => this.admin.searchTemplates(text).slice(0, size).map(toEntry);
    if (this.field.type === 'plugin') {
      this.autocomplete = getPlugins(value);
      this.cd.detectChanges();
    } else if (this.field.type === 'template') {
      this.autocomplete = getTemplates(value);
      this.cd.detectChanges();
    } else {
      this.searching?.unsubscribe();
      this.searching = this.exts.page({
        search: value,
        sort: ['nesting'],
        size: 5,
      }).pipe(
        switchMap(page => forkJoin(page.content.map(x => this.preview$(x.tag + x.origin)))),
        map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
      ).subscribe(xs => {
        this.autocomplete = xs.map(x => ({ value: x.tag, label: x.name || x.tag }));
        if (this.autocomplete.length < 5) this.autocomplete.push(...getPlugins(value, 5 - this.autocomplete.length));
        if (this.autocomplete.length < 5) this.autocomplete.push(...getTemplates(value, 5 - this.autocomplete.length));
        this.autocomplete = uniqBy(this.autocomplete, 'value')
        this.cd.detectChanges();
      });
    }
  }, 400);
}
