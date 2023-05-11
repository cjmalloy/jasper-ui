import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { flatten, uniq } from 'lodash-es';
import * as moment from 'moment';
import { catchError, map, mergeMap, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext } from '../../../model/ext';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { templates, URI_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { prefix } from '../../../util/tag';

@Component({
  selector: 'app-submit-invoice',
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss']
})
export class SubmitInvoicePage implements OnInit {
  @HostBinding('class') css = 'full-page-form';

  submitted = false;
  invoiceForm: UntypedFormGroup;
  serverError: string[] = [];

  refUrl?: string;
  queue?: string;
  plugins: string[] = [];

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Submit: Invoice`);
    this.invoiceForm = fb.group({
      url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
      title: ['', [Validators.required]],
      comment: [''],
    });
    this.ref$.pipe(
      mergeMap(ref => this.refs.page({ sources: ref.url, query: 'queue', size: 1}))
      // TODO: support multiple valid queues
    ).subscribe(page => {
      if (page.content.length) {
        this.queue = templates(page.content[0].tags, 'queue')[0];
      }
    });
  }

  ngOnInit(): void {
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

  getTags(queueExt: Ext) {
    const result = [
      'locked',
      'internal',
      prefix('plugin/invoice', queueExt.tag),
      'plugin/qr',
      this.store.account.localTag,
      ...this.plugins,
    ];
    for (const approver of queueExt.config.approvers) {
      result.push(prefix('plugin/inbox', approver));
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
    const published = this.invoiceForm.value.published ? moment(this.invoiceForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.exts.getCachedExt(this.queue!).pipe(
      switchMap(queueExt => this.refs.create({
        ...this.invoiceForm.value,
        origin: this.store.account.origin,
        published,
        tags: this.getTags(queueExt),
        sources: flatten([this.refUrl]),
      })),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', this.invoiceForm.value.url], { queryParams: { published }});
    });
  }
}
