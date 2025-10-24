import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
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
import { catchError, map, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { LimitWidthDirective } from '../../../directive/limit-width.directive';
import { EditorComponent } from '../../../form/editor/editor.component';
import { QrScannerComponent } from '../../../formly/qr-scanner/qr-scanner.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { templates, URI_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { prefix } from '../../../util/tag';

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
export class SubmitInvoicePage implements HasChanges {

  submitted = false;
  invoiceForm: UntypedFormGroup;
  serverError: string[] = [];

  refUrl?: string;
  queue?: string;
  editorTags: string[] = [];

  submitting?: Subscription;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Invoice`);
    this.invoiceForm = fb.group({
      url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
      title: ['', [Validators.required]],
      comment: [''],
    });
    this.ref$.pipe(
      // TODO: support multiple valid queues
    ).subscribe(ref => {
      if (ref) {
        this.queue = templates(ref.tags, 'queue')[0];
      }
    });
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.invoiceForm?.dirty;
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
      switchMap(queueExt => this.refs.create({
        ...this.invoiceForm.value,
        origin: this.store.account.origin,
        published,
        tags: this.getTags(queueExt),
        sources: flatten([this.refUrl]),
      })),
      catchError((res: HttpErrorResponse) => {
        delete this.submitting;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.submitting;
      this.invoiceForm.markAsPristine();
      this.router.navigate(['/ref', this.invoiceForm.value.url], { queryParams: { published }, replaceUrl: true});
    });
  }
}
