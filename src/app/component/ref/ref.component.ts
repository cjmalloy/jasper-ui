import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as moment from 'moment';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { EditorService } from '../../service/editor.service';
import { authors, interestingTags, TAG_REGEX_STRING, urlSummary, webLink } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements AfterViewInit {
  @HostBinding('class') css = 'ref list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAG_REGEX_STRING;

  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;
  @ViewChild(RefFormComponent)
  refForm?: RefFormComponent;

  editForm: FormGroup;
  submitted = false;
  expandPlugins: string[] = [];
  tagging = false;
  editing = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  actionsExpanded = false;
  writeAccess$?: Observable<boolean>;
  serverError: string[] = [];

  private _ref!: Ref;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    private editor: EditorService,
    private refs: RefService,
    private ts: TaggingService,
    private fb: FormBuilder,
  ) {
    this.editForm = refForm(fb);
  }

  get ref(): Ref {
    return this._ref;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.writeAccess$ = this.account.writeAccess(value);
    if (value.tags) {
      this.expandPlugins = this.admin.getEmbeds(value);
    }
    this.refForm?.setRef(value);
  }

  ngAfterViewInit(): void {
    this.refForm?.setRef(this._ref);
  }

  get person() {
    return this.admin.status.plugins.person &&
      this.ref.tags?.includes('plugin/person');
  }

  get canInvoice() {
    return this.admin.status.plugins.invoice &&
      this.isAuthor &&
      (this._ref.tags?.includes('plugin/comment') ||
        !this._ref.tags?.includes('internal')) &&
      this._ref.sources;
  }

  get invoice() {
    return this.admin.status.plugins.invoice &&
      this._ref.tags?.includes('plugin/invoice');
  }

  get disputed() {
    return this._ref.metadata?.plugins?.['plugin/invoice/disputed'].length;
  }

  get paid() {
    return this._ref.metadata?.plugins?.['plugin/invoice/paid'].length;
  }

  get rejected() {
    return this._ref.metadata?.plugins?.['plugin/invoice/rejected'].length;
  }

  get pdf() {
    if (!this.admin.status.plugins.pdf) return null;
    return this.ref.plugins?.['plugin/pdf']?.url || this.findPdf;
  }

  get findPdf() {
    if (!this.ref.alternateUrls) return null;
    for (const s of this.ref.alternateUrls) {
      if (new URL(s).pathname.endsWith('.pdf')) {
        return s;
      }
    }
    return null;
  }

  get archive() {
    if (!this.admin.status.plugins.archive) return null;
    return this.ref.plugins?.['plugin/archive']?.url || this.findArchive;
  }

  get findArchive() {
    if (this.ref.alternateUrls) {
      for (const s of this.ref.alternateUrls) {
        if (new URL(s).host === 'archive.ph') {
          return s;
        }
      }
    }
    return 'https://archive.ph/newest/' + this._ref.url;
  }

  get isAuthor() {
    return this._ref.tags?.includes(this.account.tag);
  }

  get isRecipient() {
    return this._ref.tags?.includes(this.account.inbox);
  }

  get authors() {
    return authors(this._ref);
  }

  get tags() {
    return interestingTags(this._ref.tags);
  }

  get host() {
    return urlSummary(this._ref.url);
  }

  get webLink() {
    return webLink(this._ref);
  }

  get approved() {
    return this._ref.tags?.includes('_moderated');
  }

  get locked() {
    return this._ref.tags?.includes('locked');
  }

  get comments() {
    if (!this._ref.metadata) return '? comments';
    const commentCount = this._ref.metadata.plugins?.['plugin/comment']?.length;
    if (commentCount === 0) return 'comment';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get responses() {
    if (!this._ref.metadata) return '? citations';
    const responseCount = this._ref.metadata.responses?.length;
    if (responseCount === 0) return 'uncited';
    if (responseCount === 1) return '1 citation';
    return responseCount + ' citations';
  }

  get sources() {
    const sourceCount = this._ref.sources?.length || 0;
    if (sourceCount === 0) return 'unsourced';
    if (sourceCount === 1) return '1 source';
    return sourceCount + ' sources';
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = (this.inlineTag.nativeElement.value as string).toLowerCase().trim();
    this.ts.create(tag, this._ref.url, this._ref.origin!).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => {
      this.tagging = false;
      this.ref = ref;
    });
  }

  approve() {
    this.refs.patch(this._ref.url, this._ref.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: '_moderated',
    }]).pipe(
      switchMap(() => this.refs.get(this._ref.url, this._ref.origin!)),
    ).subscribe(ref => this.ref = ref);
  }

  accept() {
    this.refs.delete(this._ref.metadata!.plugins['plugin/invoice/disputed'][0]).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
    ).subscribe(ref => {
      this.ref = ref;
    });
  }

  dispute() {
    this.refs.create({
      url: 'internal://' + uuid(),
      published: moment(),
      tags: ['internal', this.account.tag, 'plugin/invoice/disputed'],
      sources: [this._ref.url],
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
    ).subscribe(ref => {
      this.ref = ref;
    });
  }

  markPaid() {
    if (this._ref.metadata?.plugins?.['plugin/invoice/rejected']?.length) {
      this.refs.delete(this._ref.metadata!.plugins['plugin/invoice/rejected'][0]).pipe(
        switchMap(() => this.refs.get(this._ref.url)),
      ).subscribe(ref => {
        this.ref = ref;
      });
    }
    this.refs.create({
      url: 'internal://' + uuid(),
      published: moment(),
      tags: ['internal', this.account.tag, 'plugin/invoice/paid'],
      sources: [this._ref.url],
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
    ).subscribe(ref => {
      this.ref = ref;
    });
  }

  reject() {
    if (this._ref.metadata?.plugins?.['plugin/invoice/paid']?.length) {
      this.refs.delete(this._ref.metadata!.plugins['plugin/invoice/paid'][0]).pipe(
        switchMap(() => this.refs.get(this._ref.url)),
      ).subscribe(ref => {
        this.ref = ref;
      });
    }
    this.refs.create({
      url: 'internal://' + uuid(),
      published: moment(),
      tags: ['internal', this.account.tag, 'plugin/invoice/rejected'],
      sources: [this._ref.url],
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
    ).subscribe(ref => {
      this.ref = ref;
    });
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) return;
    this.refs.update({
      ...this.ref,
      ...this.editForm.value,
      published: moment(this.editForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
      plugins: writePlugins(this.editForm.value.plugins),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(res);
      }),
      switchMap(() => this.refs.get(this._ref.url, this._ref.origin)),
    ).subscribe(ref => {
      this.editing = false;
      this.ref = ref;
    });
  }

  delete() {
    this.refs.delete(this._ref.url, this._ref.origin!).subscribe(() => {
      this.deleted = true;
    });
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }
}
