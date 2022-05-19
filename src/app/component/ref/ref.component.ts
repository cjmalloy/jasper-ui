import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash';
import * as moment from 'moment';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { addAlt } from '../../form/alts/alts.component';
import { pluginsForm, writePlugins } from '../../form/plugins/plugins.component';
import { addSource } from '../../form/sources/sources.component';
import { addTag } from '../../form/tags/tags.component';
import { Ref } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { authors, interestingTags, TAG_REGEX, TAG_REGEX_STRING, urlSummary, webLink } from '../../util/format';
import { printError } from '../../util/http';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements OnInit {
  @HostBinding('class') css = 'ref list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAG_REGEX_STRING;

  expandable: string[] = [];

  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

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
    private refs: RefService,
    private ts: TaggingService,
    private fb: FormBuilder,
  ) {
    if (this.admin.status.plugins.qr) this.expandable.push('plugin/qr');
    if (this.admin.status.plugins.embed) this.expandable.push('plugin/embed');
    if (this.admin.status.plugins.audio) this.expandable.push('plugin/audio');
    if (this.admin.status.plugins.video) this.expandable.push('plugin/video');
    if (this.admin.status.plugins.image) this.expandable.push('plugin/image');
    this.editForm = fb.group({
      comment: [''],
      sources: fb.array([]),
      alternateUrls: fb.array([]),
      tags: fb.array([]),
      plugins: fb.group({})
    });
  }

  get ref(): Ref {
    return this._ref;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.writeAccess$ = this.account.writeAccess(this._ref);
    if (this._ref.tags) {
      this.expandPlugins = _.intersection(this._ref.tags, this.expandable);
    }
    while (this.sourcesForm.length < (this._ref?.sources?.length || 0)) this.addSource();
    while (this.altsForm.length < (this._ref?.alternateUrls?.length || 0)) this.addAlt();
    while (this.tagsForm.length < (this._ref?.tags?.length || 0)) this.addTag();
    this.editForm.setControl('plugins', pluginsForm(this.fb, this._ref.tags || []));
    this.editForm.patchValue(this._ref);
  }

  ngOnInit(): void {
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

  get tagsForm() {
    return this.editForm.get('tags') as FormArray;
  }

  get sourcesForm() {
    return this.editForm.get('sources') as FormArray;
  }

  get altsForm() {
    return this.editForm.get('alternateUrls') as FormArray;
  }

  get pluginsForm() {
    return this.editForm.get('plugins') as FormGroup;
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
    const tag = (this.inlineTag.nativeElement.value as string).toLowerCase();
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

  addTag(value = '') {
    addTag(this.fb, this.tagsForm, value);
    this.submitted = false;
  }

  addSource() {
    addSource(this.fb, this.sourcesForm, '');
    this.submitted = false;
  }

  addAlt() {
    addAlt(this.fb, this.altsForm, '');
    this.submitted = false;
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
    if (!this.editForm.valid) return;
    this.refs.update({
      ...this.ref,
      ...this.editForm.value,
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
