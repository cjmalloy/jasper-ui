import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FieldType, FieldTypeConfig, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, isString, uniqBy } from 'lodash-es';
import { catchError, of, Subscription, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AdminService } from '../service/admin.service';
import { RefService } from '../service/api/ref.service';
import { ConfigService } from '../service/config.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { getPageTitle } from '../util/format';
import { getErrorMessage } from './errors';

@Component({
  standalone: false,
  selector: 'formly-field-ref-input',
  host: {'class': 'field'},
  template: `
    <div class="form-array">
      @if (uploading) {
        <progress class="grow" max="100" [value]="progress"></progress>
      } @else {
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
               type="url"
               [attr.list]="listId"
               [class.cdk-visually-hidden]="preview"
               (input)="search(input.value)"
               cdkMonitorElementFocus
               (cdkFocusChange)="$event ? edit(input) : blur(input)"
               [formControl]="formControl"
               [formlyAttributes]="field"
               [class.is-invalid]="showError">
      }
      @if (field.type   ===    'qr') { <app-qr-scanner   (data)="$event && field.formControl!.setValue($event)"></app-qr-scanner> }
      @if (files) {
        @if (field.type ===   'pdf') { <app-pdf-upload   (data)="onUpload($event)"></app-pdf-upload> }
        @if (field.type === 'audio') { <app-audio-upload (data)="onUpload($event)"></app-audio-upload> }
        @if (field.type === 'video') { <app-video-upload (data)="onUpload($event)"></app-video-upload> }
        @if (field.type === 'image') { <app-image-upload (data)="onUpload($event)"></app-image-upload> }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyFieldRefInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {

  listId = uuid();
  previewUrl = '';
  preview = '';
  editing = false;
  progress?: number;
  uploading = false;
  files = !!this.admin.getPlugin('plugin/file');
  autocomplete: { value: string, label: string }[] = [];

  private showedError = false;
  private searching?: Subscription;
  private formChanges?: Subscription;

  constructor(
    private configs: ConfigService,
    public store: Store,
    private config: FormlyConfig,
    private refs: RefService,
    private editor: EditorService,
    private admin: AdminService,
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
    if (value === this.previewUrl) return;
    this.previewUrl = value;
    this.refs.getCurrent(value).pipe(
      catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
    ).subscribe(ref => {
      if (ref) {
        this.preview = getPageTitle(ref);
        this.cd.detectChanges();
      } else if (value.toLowerCase().startsWith('tag:/')) {
        this.editor.getTagPreview(value.substring('tag:/'.length)).subscribe(x => {
          this.preview = x?.name || x?.tag || '';
          this.cd.detectChanges();
        });
      }
    });
  }

  edit(input: HTMLInputElement) {
    this.editing = true;
    this.preview = '';
    this.previewUrl = '';
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      window.open(this.configs.base + 'ref/' + input.value);
    } else {
      this.edit(input);
    }
  }

  search = debounce((value: string) => {
    this.showedError = false;
    this.searching?.unsubscribe();
    this.searching = this.refs.page({
      search: value,
      size: 3,
    }).subscribe(page => {
      this.autocomplete = uniqBy(page.content, ref => ref.url).map(ref => ({ value: ref.url, label: getPageTitle(ref) }));
      this.cd.detectChanges();
    })
  }, 400);

  onUpload(event?: { url?: string, name: string, progress?: number } | string) {
    if (!event) {
      this.uploading = false;
    } else if (isString(event)) {
      // TODO set error
    } else if (event.url) {
      this.uploading = false;
      this.preview = event.name;
      this.field.formControl!.setValue(event.url);
    } else {
      this.uploading = true;
      this.progress = event.progress || undefined;
    }
    this.cd.detectChanges();
  }
}
