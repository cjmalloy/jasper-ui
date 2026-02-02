import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, uniqBy } from 'lodash-es';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Config } from '../model/tag';
import { AdminService } from '../service/admin.service';
import { ExtService } from '../service/api/ext.service';
import { ConfigService } from '../service/config.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { getErrorMessage } from './errors';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'formly-field-tag-input',
  host: { 'class': 'field' },
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
             [class.hidden-without-removing]="preview"
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
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
  ],
})
export class FormlyFieldTagInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {
  private configs = inject(ConfigService);
  private config = inject(FormlyConfig);
  private admin = inject(AdminService);
  private editor = inject(EditorService);
  private exts = inject(ExtService);
  store = inject(Store);
  private cd = inject(ChangeDetectorRef);


  listId = 'list-' + uuid();
  preview = '';
  editing = false;
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private previewing?: Subscription;
  private searching?: Subscription;
  private formChanges?: Subscription;

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
    this.editing = false;
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
      this.preview = x?.name || x?.tag || '';
      this.cd.detectChanges();
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
        query: this.props.prefix || '',
        search: value,
        sort: ['origin:len', 'tag:len'],
        size: 5,
      }).pipe(
        switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
        map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
      ).subscribe(xs => {
        this.autocomplete = xs.map(x => ({ value: x.tag, label: x.name || x.tag }));
        if (this.autocomplete.length < 5) this.autocomplete.push(...getPlugins(value, 5 - this.autocomplete.length));
        if (this.autocomplete.length < 5) this.autocomplete.push(...getTemplates(value, 5 - this.autocomplete.length));
        this.autocomplete = uniqBy(this.autocomplete, 'value');
        this.cd.detectChanges();
      });
    }
  }, 400);
}
