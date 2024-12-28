import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer } from 'lodash-es';
import { Subscription } from 'rxjs';
import { ExtService } from '../service/api/ext.service';
import { Store } from '../store/store';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-tag-input',
  host: {'class': 'field'},
  template: `
    <div class="form-array">
      <div class="preview grow"
           type="text"
           [style.display]="preview ? 'block' : 'none'"
           (click)="edit(input)"
           (focus)="edit(input)">{{ preview }}</div>
      <input #input
             class="grow"
             type="email"
             [attr.list]="id + '_list'"
             [style.opacity]="preview ? 0 : 1"
             [style.position]="preview ? 'absolute' : 'relative'"
             (input)="search(input.value)"
             (blur)="blur(input)"
             (focusin)="edit(input)"
             (focus)="edit(input)"
             (focusout)="getPreview(input.value)"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      <datalist [id]="id + '_list'">
        @for (o of autocomplete; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </datalist>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldTagInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  preview = '';
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;

  constructor(
    private config: FormlyConfig,
    private exts: ExtService,
    private store: Store,
    private cd: ChangeDetectorRef,
  ) {
    super();
  }

  ngAfterViewInit() {
    this.field.hooks ||= {};
    this.field.hooks.afterViewInit = (field) => {
      this.getPreview(this.model[this.key as any]);
      this.formChanges?.unsubscribe();
      this.formChanges = field.formControl!.valueChanges.subscribe(() => {
        if (this.preview) {
          this.preview = '';
          this.getPreview(this.model[this.key as any]);
        }
      });
    }
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
    this.exts.getCachedExt(value).subscribe(x => {
      if (!x.modified) {
        this.preview = '';
      } else {
        this.preview = x.name || x.tag;
      }
      this.cd.detectChanges();
    });
  }

  edit(input: HTMLInputElement) {
    this.preview = '';
    input.focus();
  }

  search = debounce((value: string) => {
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: this.store.account.origin || '@',
      search: value,
      size: 5,
    }).subscribe(page => {
      this.autocomplete = page.content.map(x => ({ value: x.tag, label: x.name || x.tag }));
    })
  }, 400)
}
