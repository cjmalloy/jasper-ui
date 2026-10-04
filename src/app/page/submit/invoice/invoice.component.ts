import {
  HttpErrorResponse
} from '@angular/common/http';
import { Component, viewChild, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { flatten, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, firstValueFrom, forkJoin, interval, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { EditorComponent } from '../../../form/editor/editor.component';
import { QrScannerComponent } from '../../../formly/qr-scanner/qr-scanner.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Ref } from '../../../model/ref';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid, controlState, controlValue } from '../../../util/form';
import { templates, URI_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { getVisibilityTags, prefix } from '../../../util/tag';

@Component({
  selector: 'app-submit-invoice',
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss'],
  host: { 'class': 'full-page-form' },
  imports: [
    EditorComponent,
    ReactiveFormsModule,
    QrScannerComponent,
    LoadingComponent,
  ]
})
export class SubmitInvoicePage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private editor = inject(EditorService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private ts = inject(TaggingService);
  private fb = inject(UntypedFormBuilder);



  readonly submitted = signal<boolean>(false);
  invoiceForm: UntypedFormGroup;
  protected readonly invoiceFormValid = controlState(() => this.invoiceForm, c => c.valid);
  protected readonly invoiceFormValue = controlValue(() => this.invoiceForm);
  protected readonly titleRequired = controlState(() => this.title, c => c.touched && !!c.errors?.['required']);
  readonly serverError = signal<string[]>([]);

  readonly editorComponent = viewChild<EditorComponent>('editor');

  refUrl?: string;
  readonly queue = signal<string | undefined>(undefined);
  editorTags: string[] = [];
  readonly completedUploads = signal<Ref[]>([]);

  readonly submitting = signal(false);
  private submittingSubscription?: Subscription;
  readonly saving = signal(false);
  private savingSubscription?: Subscription;
  private cursor?: string;

  constructor() {
    const mod = this.mod;
    const fb = this.fb;

    mod.setTitle($localize`Submit: Invoice`);
    this.invoiceForm = fb.group({
      url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
      title: ['', [Validators.required]],
      comment: [''],
    });
    if (this.admin.editing()) {
      interval(5_000).pipe(
        takeUntilDestroyed(),
      ).subscribe(() => {
        if (this.invoiceForm.dirty) this.saveForLater();
      });
    }
    this.ref$.pipe(
      // TODO: support multiple valid queues
    ).subscribe(ref => {
      if (ref) {
        this.queue.set(templates(ref.tags, 'queue')[0]);
      }
    });
  }

  addCompletedUpload(ref: Ref) {
    this.completedUploads.update(uploads => [...uploads, ref]);
  }

  async saveChanges() {
    if (this.admin.editing() && this.invoiceForm.dirty) {
      return firstValueFrom(this.refs.saveEdit(this.writeRef(), this.cursor)
        .pipe(map(() => true), catchError(() => of(false))));
    }
    return !this.invoiceForm?.dirty;
  }

  saveForLater(leave = false) {
    const savedValue = JSON.stringify(this.invoiceForm.value);
    this.saving.set(true);
    this.savingSubscription = this.refs.saveEdit(this.writeRef(), this.cursor)
      .pipe(catchError(err => {
        this.saving.set(false);
        return throwError(() => err);
      }))
      .subscribe(cursor => {
        this.saving.set(false);
        this.cursor = cursor;
        if (JSON.stringify(this.invoiceForm.value) === savedValue) this.invoiceForm.markAsPristine();
        if (leave) this.router.navigate(['/inbox/ref', 'plugin/editing']);
      });
    this.savingSubscription?.add(() => this.saving.set(false));
  }


  writeRef() {
    return <Ref> {
      ...this.invoiceForm.value,
      origin: this.store.account.origin(),
    };
  }

  checkUrl() {
    // Try to fix common problems
    if (!this.url.valid) {
      if (this.url.value.startsWith('lnbc')) {
        this.url.setValue('lightning:' + this.url.value);
      } else if (this.url.value.startsWith('bc1')) {
        this.url.setValue('bitcoin:' + this.url.value);
      }
    }
  }

  get refUrl$() {
    return this.route.queryParams.pipe(
      map(params => params['url']),
      tap(url => this.refUrl = url),
    );
  }

  get ref$() {
    return this.refUrl$.pipe(
      switchMap(url => this.refs.get(url, this.store.account.origin())),
    );
  }

  get url() {
    return this.invoiceForm.get('url') as UntypedFormControl;
  }

  get title() {
    return this.invoiceForm.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.invoiceForm.get('comment') as UntypedFormControl;
  }

  validate(input: HTMLInputElement) {
    this.checkUrl();
    if (this.url.touched) {
      if (this.url.errors?.['pattern']) {
        input.setCustomValidity($localize`QR Code must be a valid URI according to RFC 3986.`);
        input.reportValidity();
      } else if (this.url.errors?.['required']) {
        input.setCustomValidity($localize`QR Code must not be blank.`);
        input.reportValidity();
      }
    }
  }

  getTags(queueExt: Ext) {
    const addTags = this.editorTags.filter(t => !t.startsWith('-'));
    const removeTags = this.editorTags.filter(t => t.startsWith('-')).map(t => t.substring(1));
    const result = without([
      'locked',
      prefix('plugin/invoice', queueExt.tag),
      'plugin/qr',
      ...(this.store.account.localTag() ? [this.store.account.localTag()] : []),
      ...addTags,
    ], ...removeTags);
    for (const approver of queueExt.config?.approvers || []) {
      result.push(getMailbox(approver, this.store.account.origin()));
    }
    return uniq(result);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.invoiceForm);
  }

  submit() {
    if (this.saving()) {
      this.savingSubscription?.add(() => this.submit());
      return;
    }
    this.serverError.set([]);
    this.submitted.set(true);
    this.invoiceForm.markAllAsTouched();
    this.syncEditor();
    if (!this.invoiceForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = this.invoiceForm.value.published ? DateTime.fromISO(this.invoiceForm.value.published) : DateTime.now();
    this.submitting.set(true);
    this.submittingSubscription = this.exts.getCachedExt(this.queue()!).pipe(
      switchMap(queueExt => {
        const finalTags = this.getTags(queueExt);
        const ref = {
          ...this.invoiceForm.value,
          origin: this.store.account.origin(),
          published,
          tags: finalTags,
          sources: flatten([this.refUrl]),
        };
        return (this.cursor ? this.refs.update({ ...ref, modifiedString: this.cursor }) : this.refs.create(ref)).pipe(
          switchMap(res => {
            const finalVisibilityTags = getVisibilityTags(finalTags);
            if (!finalVisibilityTags.length) return of(res);
            const taggingOps = this.completedUploads()
              .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
            if (!taggingOps.length) return of(res);
            return forkJoin(taggingOps).pipe(map(() => res));
          }),
        );
      }),
      catchError((res: HttpErrorResponse) => {
        this.submitting.set(false);
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitting.set(false);
      this.invoiceForm.markAsPristine();
      this.completedUploads.set([]);
      this.router.navigate(['/ref', this.invoiceForm.value.url], { queryParams: { published }, replaceUrl: true});
    });
    this.submittingSubscription?.add(() => this.submitting.set(false));
  }
}
