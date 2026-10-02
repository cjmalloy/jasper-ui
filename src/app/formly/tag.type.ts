import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Config } from '../model/tag';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { config, ConfigService } from '../service/config.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { getErrorMessage } from './errors';

@Component({
  selector: 'formly-field-tag-input',
  host: { 'class': 'field tag-field' },
  template: `
    <div class="form-array skip-margin">
      <input class="preview grow"
             type="text"
             [value]="preview()"
             [title]="input.value"
             [style.display]="preview() ? 'block' : 'none'"
             (focus)="clickPreview(input)">
      <datalist [id]="listId">
        @for (o of autocomplete(); track o.value) {
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
             [class.hidden-without-removing]="preview()"
             (input)="search(input.value)"
             (blur)="blur(input)"
             (focusin)="edit(input)"
             (focus)="edit(input)"
             (focusout)="getPreview(input.value)"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldTagInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  listId = 'list-' + uuid();
  readonly preview = signal('');
  readonly editing = signal(false);
  readonly autocomplete = signal<{ value: string, label: string }[]>([]);

  private showedError = false;
  private previewing?: Subscription;
  private searching?: Subscription;
  private formChanges?: Subscription;

  constructor(
    private configs: ConfigService,
    private config: FormlyConfig,
    private admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
    public store: Store,
  ) {
    super();
  }




  ngAfterViewInit() {
    if (this.model) this.getPreview(this.model[this.key as any]);
    this.formChanges?.unsubscribe();
    this.formChanges = this.formControl.valueChanges.subscribe(value => {
      if (!this.editing() && value) {
        this.getPreview(value);
      } else {
        this.preview.set('');
      }
    });
  }

  ngOnDestroy() {
    this.previewing?.unsubscribe();
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
    this.editing.set(false);
    if (this.showError && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
      this.getPreview(input.value);
    }
  }

  getPreview(value: string) {
    if (!value) return;
    if (this.showError) return;
    this.previewing?.unsubscribe();
    this.previewing = this.preview$(value).subscribe((x?: { name?: string, tag: string }) => {
      this.preview.set(x?.name || x?.tag || '');
    });
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.editor.getTagPreview(
      value,
      this.field.props.origin || this.store.account.origin,
      false,
      this.field.type !== 'plugin',
      this.field.type !== 'template');
  }

  edit(input: HTMLInputElement) {
    this.editing.set(true);
    this.preview.set('');
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      this.configs.tag(input.value);
    } else {
      this.edit(input);
    }
  }

  search = debounce((value: string) => {
    const siblings = (this.formControl.parent?.value as string[] || []).filter(t => t && t !== this.formControl.value);
    const derank = (xs: { value: string, label: string }[]) =>
      [...xs.filter(x => !siblings.includes(x.value)), ...xs.filter(x => siblings.includes(x.value))];
    const toEntry = (p: Config) => ({ value: p.tag, label: p.name || p.tag });
    const getPlugins = (text: string, size = 5) => this.admin.searchPlugins(text).slice(0, size).map(toEntry);
    const getTemplates = (text: string, size = 5) => this.admin.searchTemplates(text).slice(0, size).map(toEntry);
    if (this.field.type === 'plugin') {
      this.autocomplete.set(derank(getPlugins(value)));
    } else if (this.field.type === 'template') {
      this.autocomplete.set(derank(getTemplates(value)));
    } else {
      this.searching?.unsubscribe();
      this.searching = this.exts.page({
        query: this.props.prefix || '',
        search: value,
        sort: ['origin:len', 'tag:len'],
        size: 5,
      }).pipe(
        switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
        map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
      ).subscribe(xs => {
        const autocomplete = xs.map(x => ({ value: x.tag, label: x.name || x.tag }));
        if (autocomplete.length < 5) autocomplete.push(...getPlugins(value, 5 - autocomplete.length));
        if (autocomplete.length < 5) autocomplete.push(...getTemplates(value, 5 - autocomplete.length));
        this.autocomplete.set(derank(uniqBy(autocomplete, 'value')));
      });
    }
  }, 400);
}
