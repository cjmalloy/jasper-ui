import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash';
import * as moment from 'moment';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext } from '../../../model/ext';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { templates, URI_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { prefix } from '../../../util/tag';

@Component({
  selector: 'app-submit-invoice',
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss']
})
export class SubmitInvoicePage implements OnInit {

  submitted = false;
  invoiceForm: UntypedFormGroup;
  serverError: string[] = [];

  refUrl?: string;
  validQueues?: string[];
  queue?: string;
  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Submit: Invoice');
    this.invoiceForm = fb.group({
      url: ['', [Validators.required, Validators.pattern(URI_REGEX)]],
      title: ['', [Validators.required]],
      comment: [''],
    });
    this.ref$.pipe(
      map(ref => ref.sources),
      switchMap(sources => sources ? this.refs.list(sources) : of([]))
    ).subscribe(sources => {
      this.validQueues = sources
        .filter(s => !!s)
        .flatMap(s => templates(s!.tags, 'queue'));
      if (this.validQueues?.length) this.queue = this.validQueues[0];
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
      switchMap(url => this.refs.get(url)),
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
      'plugin/invoice',
      prefix('plugin/invoice/', queueExt.tag),
      'plugin/qr',
      this.account.tag,
    ];
    for (const approver of queueExt.config.approvers) {
      result.push(prefix('plugin/inbox/', approver));
    }
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return _.uniq(result);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.invoiceForm);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.invoiceForm.markAllAsTouched();
    this.syncEditor();
    if (!this.invoiceForm.valid) return;
    this.exts.get(this.queue!).pipe(
      switchMap(queueExt => this.refs.create({
        ...this.invoiceForm.value,
        published: moment(),
        tags: this.getTags(queueExt),
        sources: [this.refUrl],
      })),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', this.invoiceForm.value.url]);
    });
  }
}
