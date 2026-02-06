import { HttpEventType } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FieldType, FieldTypeConfig, FormlyAttributes, FormlyConfig } from '@ngx-formly/core';
import { debounce, defer, isString, uniqBy } from 'lodash-es';
import { catchError, last, map, of, Subscription, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { ProxyService } from '../service/api/proxy.service';
import { RefService } from '../service/api/ref.service';
import { ConfigService } from '../service/config.service';
import { EditorService } from '../service/editor.service';
import { Store } from '../store/store';
import { Saving } from '../store/submit';
import { readFileAsDataURL } from '../util/async';
import { getPageTitle } from '../util/format';
import { AudioUploadComponent } from './audio-upload/audio-upload.component';
import { getErrorMessage } from './errors';
import { ImageUploadComponent } from './image-upload/image-upload.component';
import { PdfUploadComponent } from './pdf-upload/pdf-upload.component';
import { QrScannerComponent } from './qr-scanner/qr-scanner.component';
import { VideoUploadComponent } from './video-upload/video-upload.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'formly-field-ref-input',
  host: { 'class': 'field' },
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
               (focus)="clickPreview(input)"
               (drop)="upload($event, $event.dataTransfer?.items)"
               (paste)="upload($event, $event.clipboardData?.items)">
        <datalist [id]="listId">
          @for (o of autocomplete; track o.value) {
            <option [value]="o.value">{{ o.label }}</option>
          }
        </datalist>
        <input #input
               class="grow"
               type="url"
               [attr.list]="listId"
               [class.hidden-without-removing]="preview"
               (input)="search(input.value)"
               (blur)="blur(input)"
               (focusin)="edit(input)"
               (focus)="edit(input)"
               (focusout)="getPreview(input.value)"
               (drop)="upload($event, $event.dataTransfer?.items)"
               (paste)="upload($event, $event.clipboardData?.items)"
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
  imports: [
    ReactiveFormsModule,
    QrScannerComponent,
    PdfUploadComponent,
    AudioUploadComponent,
    VideoUploadComponent,
    ImageUploadComponent,
    FormlyAttributes,
  ],
})
export class FormlyFieldRefInput extends FieldType<FieldTypeConfig> implements AfterViewInit, OnDestroy {
  private configs = inject(ConfigService);
  store = inject(Store);
  private config = inject(FormlyConfig);
  private refs = inject(RefService);
  private editor = inject(EditorService);
  private proxy = inject(ProxyService);
  private admin = inject(AdminService);
  private cd = inject(ChangeDetectorRef);


  listId = 'list-' + uuid();
  previewUrl = '';
  preview = '';
  editing = false;
  progress = 0;
  uploading = false;
  files = !!this.admin.getPlugin('plugin/file');
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
    if (value === this.previewUrl) return;
    this.previewUrl = value;
    this.previewing?.unsubscribe();
    this.previewing = this.refs.getCurrent(value).pipe(
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

  onUpload(event?: Saving | string) {
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
      this.progress = event.progress || 0;
    }
    this.cd.detectChanges();
  }

  upload(event: Event, items?: DataTransferItemList) {
    this.onUpload();
    if (!items) return;
    const files = [] as any;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind == 'file') {
        files.push(d.getAsFile());
        break;
      }
    }
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    const file = files[0]!;
    this.onUpload({ name: file.name });
    this.proxy.save(file, this.store.account.origin).pipe(
      map(event => {
        switch (event.type) {
          case HttpEventType.Response:
            return event.body;
          case HttpEventType.UploadProgress:
            const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
            this.onUpload({ name: file.name, progress: percentDone });
            return null;
        }
        return null;
      }),
      last(),
      map((ref: Ref | null) => ref?.url),
      catchError(err => readFileAsDataURL(file)) // base64
    ).subscribe(url => this.onUpload({ url, name: file.name }));
  }
}
