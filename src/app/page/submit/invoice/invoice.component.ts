import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, ViewChild } from '@angular/core';
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
import { catchError, firstValueFrom, forkJoin, interval, map, of, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { LimitWidthDirective } from '../../../directive/limit-width.directive';
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
import { scrollToFirstInvalid } from '../../../util/form';
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
    LimitWidthDirective,
    QrScannerComponent,
    LoadingComponent,
  ]
})
export class SubmitInvoicePage implements OnDestroy, HasChanges {

  private destroy$ = new Subject<void>();

  submitted = false;
  invoiceForm: UntypedFormGroup;
  serverError: string[] = [];

  @ViewChild('editor')
  editorComponent?: EditorComponent;

  refUrl?: string;
  queue?: string;
  editorTags: string[] = [];
  completedUploads: Ref[] = [];

  submitting?: Subscription;
  saving?: Subscription;
  private cursor?: string;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Invoice`);
    this.invoiceForm = fb.group({
      url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
      title: ['', [Validators.required]],
      comment: [''],
    });
    if (this.admin.editing) {
      interval(5_000).pipe(
        takeUntil(this.destroy$),
      ).subscribe(() => {
        if (this.invoiceForm.dirty) this.saveForLater();
      });
    }
    this.ref$.pipe(
      // TODO: support multiple valid queues
    ).subscribe(ref => {
      if (ref) {
        this.queue = templates(ref.tags, 'queue')[0];
      }
    });
  }

  async saveChanges() {
    if (this.admin.editing && this.invoiceForm.dirty) {
      return firstValueFrom(this.refs.saveEdit(this.writeRef(), this.cursor)
        .pipe(map(() => true), catchError(() => of(false))));
    }
    return !this.invoiceForm?.dirty;
  }

  saveForLater(leave = false) {
    const savedValue = JSON.stringify(this.invoiceForm.value);
    this.saving = this.refs.saveEdit(this.writeRef(), this.cursor)
      .pipe(catchError(err => {
        delete this.saving;
        return throwError(() => err);
      }))
      .subscribe(cursor => {
        delete this.saving;
        this.cursor = cursor;
        if (JSON.stringify(this.invoiceForm.value) === savedValue) this.invoiceForm.markAsPristine();
        if (leave) this.router.navigate(['/inbox/ref', 'plugin/editing']);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  writeRef() {
    return <Ref> {
      ...this.invoiceForm.value,
      origin: this.store.account.origin,
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
      switchMap(url => this.refs.get(url, this.store.account.origin)),
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
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...addTags,
    ], ...removeTags);
    for (const approver of queueExt.config?.approvers || []) {
      result.push(getMailbox(approver, this.store.account.origin));
    }
    return uniq(result);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.invoiceForm);
  }

  submit() {
    if (this.saving) {
      this.saving.add(() => this.submit());
      return;
    }
    this.serverError = [];
    this.submitted = true;
    this.invoiceForm.markAllAsTouched();
    this.syncEditor();
    if (!this.invoiceForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = this.invoiceForm.value.published ? DateTime.fromISO(this.invoiceForm.value.published) : DateTime.now();
    this.submitting = this.exts.getCachedExt(this.queue!).pipe(
      switchMap(queueExt => {
        const finalTags = this.getTags(queueExt);
        const ref = {
          ...this.invoiceForm.value,
          origin: this.store.account.origin,
          published,
          tags: finalTags,
          sources: flatten([this.refUrl]),
        };
        return (this.cursor ? this.refs.update({ ...ref, modifiedString: this.cursor }) : this.refs.create(ref)).pipe(
          switchMap(res => {
            const finalVisibilityTags = getVisibilityTags(finalTags);
            if (!finalVisibilityTags.length) return of(res);
            const taggingOps = this.completedUploads
              .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
            if (!taggingOps.length) return of(res);
            return forkJoin(taggingOps).pipe(map(() => res));
          }),
        );
      }),
      catchError((res: HttpErrorResponse) => {
        delete this.submitting;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.submitting;
      this.invoiceForm.markAsPristine();
      this.completedUploads = [];
      this.router.navigate(['/ref', this.invoiceForm.value.url], { queryParams: { published }, replaceUrl: true});
    });
  }
}
