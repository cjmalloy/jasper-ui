import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, uniqBy } from 'lodash-es';
import { Subscription } from 'rxjs';
import { AdminService } from '../service/admin.service';
import { RefService } from '../service/api/ref.service';
import { getPageTitle } from '../util/format';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-ref-input',
  host: {'class': 'field'},
  template: `
    <div class="form-array">
      <div class="preview grow"
           type="text"
           [style.display]="preview ? 'block' : 'none'"
           (click)="edit()"
           (focus)="edit()">{{ preview }}</div>
      <input class="grow"
             type="url"
             [attr.list]="id + '_list'"
             [style.opacity]="preview ? 0 : 1"
             [style.position]="preview ? 'absolute' : 'relative'"
             (input)="search($any($event.target).value)"
             (blur)="blur($any($event.target))"
             (focusin)="edit()"
             (focus)="edit()"
             (focusout)="getPreview($any($event.target).value)"
             [formControl]="formControl"
             [formlyAttributes]="field"
             [class.is-invalid]="showError">
      <datalist [id]="id + '_list'">
        @for (o of autocomplete; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </datalist>
      @if (field.type   ===    'qr') { <app-qr-scanner   (data)="$event && field.formControl!.setValue($event)"></app-qr-scanner> }
      @if (files) {
        @if (field.type ===   'pdf') { <app-pdf-upload   (data)="$event && field.formControl!.setValue($event)"></app-pdf-upload> }
        @if (field.type === 'audio') { <app-audio-upload (data)="$event && field.formControl!.setValue($event)"></app-audio-upload> }
        @if (field.type === 'video') { <app-video-upload (data)="$event && field.formControl!.setValue($event)"></app-video-upload> }
        @if (field.type === 'image') { <app-image-upload (data)="$event && field.formControl!.setValue($event)"></app-image-upload> }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldRefInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  previewUrl = '';
  preview = '';
  files = !!this.admin.getPlugin('plugin/file');
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;

  constructor(
    private config: FormlyConfig,
    private refs: RefService,
    private admin: AdminService,
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
    if (value === this.previewUrl) return;
    this.previewUrl = value;
    this.refs.getCurrent(value).subscribe(ref => {
      this.preview = getPageTitle(ref);
      this.cd.detectChanges();
    });
  }

  edit() {
    this.previewUrl = '';
    this.preview = '';
  }

  search = debounce((value: string) => {
    this.showedError = false;
    this.searching?.unsubscribe();
    this.searching = this.refs.page({
      search: value,
      size: 3,
    }).subscribe(page => {
      this.autocomplete = uniqBy(
        page.content.map(ref => ({ value: ref.url, label: getPageTitle(ref) })),
        o => o.value);
      this.cd.detectChanges();
    })
  }, 400);
}
