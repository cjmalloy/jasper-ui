import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { catchError, mergeMap, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { Ref } from '../../model/ref';
import { deleteNotice } from '../../plugin/delete';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { authors, clickableLink, formatAuthor, interestingTags, TAGS_REGEX, urlSummary } from '../../util/format';
import { printError } from '../../util/http';
import { hasTag, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements OnInit {
  @HostBinding('class') css = 'ref list-item';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAGS_REGEX.source;

  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;

  editForm: UntypedFormGroup;
  submitted = false;
  expandPlugins: string[] = [];
  tagging = false;
  editing = false;
  viewSource = false;
  deleting = false;
  @HostBinding('class.deleted')
  deleted = false;
  actionsExpanded = false;
  writeAccess = false;
  serverError: string[] = [];
  publishChanged = false;

  private _ref!: Ref;

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private scraper: ScrapeService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
  }

  get ref(): Ref {
    return this._ref;
  }

  get origin() {
    return this._ref.origin || undefined;
  }

  @Input()
  set ref(value: Ref) {
    this.submitted = false;
    this.deleted = false;
    this.deleting = false;
    this.editing = false;
    this.viewSource = false;
    this.tagging = false;
    this.actionsExpanded = false;
    this._ref = value;
    this.writeAccess = this.auth.writeAccess(value);
    if (value.tags) {
      this.expandPlugins = this.admin.getEmbeds(value.tags);
    }
  }

  @ViewChild(RefFormComponent)
  set refForm(value: RefFormComponent) {
    _.defer(() => {
      value?.setRef(this._ref);
      this.editor.syncEditor(this.fb, this.editForm, this._ref.comment);
    });
  }

  ngOnInit(): void {
  }

  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  get feed() {
    return !!this.admin.status.plugins.feed && hasTag('+plugin/feed', this.ref);
  }

  get comment() {
    return !!this.admin.status.plugins.comment && hasTag('plugin/comment', this.ref);
  }

  get remote() {
    return !!this.admin.status.plugins.origin && hasTag('+plugin/origin', this.ref);
  }

  get addTags() {
    if (this.feed) {
      return interestingTags(this.ref.plugins!['+plugin/feed'].addTags);
    }
    if (this.remote) {
      return interestingTags(this.ref.plugins!['+plugin/origin'].addTags);
    }
    return undefined;
  }

  get addOrigin() {
    if (this.feed) {
      return this.ref.plugins!['+plugin/feed'].origin;
    }
    if (this.remote) {
      return this.ref.plugins!['+plugin/origin'].origin;
    }
    return undefined;
  }

  get scraped() {
    if (this.feed) {
      return !!this.ref.plugins!['+plugin/feed'].lastScrape;
    }
    if (this.remote) {
      return !!this.ref.plugins!['+plugin/origin'].lastScrape;
    }
    return false;
  }

  get lastScrape() {
    if (this.feed) {
      return moment(this.ref.plugins!['+plugin/feed'].lastScrape);
    }
    if (this.remote) {
      return moment(this.ref.plugins!['+plugin/origin'].lastScrape);
    }
    throw "Not scraped";
  }

  get thumbnail() {
    return this.admin.status.plugins.thumbnail &&
      hasTag('plugin/thumbnail', this._ref);
  }

  get person() {
    return this.admin.status.plugins.person &&
      hasTag('plugin/person', this._ref);
  }

  get canInvoice() {
    if (this._ref.origin) return false;
    if (!this.admin.status.plugins.invoice) return false;
    if (!this.isAuthor) return false;
    if (!this._ref.sources || !this._ref.sources.length) return false;
    return hasTag('plugin/comment', this._ref) ||
      !hasTag('internal', this._ref);
  }

  get invoice() {
    return this.admin.status.plugins.invoice &&
      hasTag('plugin/invoice', this._ref);
  }

  get disputed() {
    return this._ref.metadata?.plugins?.['plugin/invoice/disputed'];
  }

  get paid() {
    return this._ref.metadata?.plugins?.['plugin/invoice/paid'];
  }

  get rejected() {
    return this._ref.metadata?.plugins?.['plugin/invoice/rejected'];
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

  get scrapeable() {
    return this.feed || this.remote;
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
    return hasTag(this.store.account.tag, this._ref);
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this._ref);
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

  get clickableLink() {
    return clickableLink(this._ref);
  }

  get approved() {
    return hasTag('_moderated', this._ref);
  }

  get locked() {
    return hasTag('locked', this._ref);
  }

  get comments() {
    let commentCount : number | string = '?';
    if (this._ref.metadata?.modified) {
      commentCount = this._ref.metadata?.plugins?.['plugin/comment'] || 0;
    }
    if (commentCount === 0) return 'comment';
    if (commentCount === 1) return '1 comment';
    return commentCount + ' comments';
  }

  get responses() {
    let responseCount : number | string = '?';
    if (this._ref.metadata?.modified) {
      responseCount = this._ref.metadata?.responses || 0;
    }
    if (this.feed) {
      return responseCount + ' scraped';
    }
    if (responseCount === 0) return 'uncited';
    if (responseCount === 1) return '1 citation';
    return responseCount + ' citations';
  }

  get sources() {
    const sourceCount = this._ref.sources?.length || 0;
    if (sourceCount === 0) return 'unsourced';
    if (sourceCount === 1) {
      if (this.comment) return 'parent';
      return '1 source';
    }
    return sourceCount + ' sources';
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  addInlineTag(tag: string) {
    tag = tag.toLowerCase().trim();
    this.ts.create(tag, this._ref.url, this._ref.origin!).pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
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
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  accept() {
    if (this._ref.metadata!.plugins?.['plugin/invoice/disputed'] > 1) {
      console.warn('Multiple disputes found');
    }
    this.refs.page({
      responses: this._ref.url,
      query: 'plugin/invoice/disputed:' + this.store.account.localTag,
      size: 1
    }).pipe(
      mergeMap(page => this.refs.delete(page.content[0].url)),
      switchMap(() => this.refs.get(this._ref.url)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  dispute() {
    this.refs.create({
      url: 'internal:' + uuid(),
      published: moment(),
      tags: ['internal', this.store.account.localTag, 'plugin/invoice/disputed'],
      sources: [this._ref.url],
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  markPaid() {
    if (this._ref.metadata?.plugins?.['plugin/invoice/rejected']) {
      if (this._ref.metadata?.plugins?.['plugin/invoice/rejected'] > 1) {
        console.warn('Multiple rejections found');
      }
      this.refs.page({
        responses: this._ref.url,
        query: 'plugin/invoice/rejected:' + this.store.account.localTag,
        size: 1
      }).pipe(
        mergeMap(page => this.refs.delete(page.content[0].url)),
        switchMap(() => this.refs.get(this._ref.url)),
        catchError((err: HttpErrorResponse) => {
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      ).subscribe(ref => {
        this.serverError = [];
        this.ref = ref;
      });
    }
    this.refs.create({
      url: 'internal:' + uuid(),
      published: moment(),
      tags: ['internal', this.store.account.localTag, 'plugin/invoice/paid'],
      sources: [this._ref.url],
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  reject() {
    if (this._ref.metadata?.plugins?.['plugin/invoice/paid']) {
      if (this._ref.metadata?.plugins?.['plugin/invoice/paid'] > 1) {
        console.warn('Multiple paid approvals found');
      }
      this.refs.page({
        responses: this._ref.url,
        query: 'plugin/invoice/paid:' + this.store.account.localTag,
        size: 1
      }).pipe(
        mergeMap(page => this.refs.delete(page.content[0].url)),
        switchMap(() => this.refs.get(this._ref.url)),
        catchError((err: HttpErrorResponse) => {
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      ).subscribe(ref => {
        this.serverError = [];
        this.ref = ref;
      });
    }
    this.refs.create({
      url: 'internal:' + uuid(),
      published: moment(),
      tags: ['internal', this.store.account.localTag, 'plugin/invoice/rejected'],
      sources: [this._ref.url],
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  scrape() {
    this.scraper.feed(this.ref.url, this.ref.origin!).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin)),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    this.editor.syncEditor(this.fb, this.editForm);
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = moment(this.editForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    this.refs.update({
      ...this.ref,
      ...this.editForm.value,
      published,
      plugins: writePlugins(this.editForm.value.tags, {
        ...this.ref.plugins,
        ...this.editForm.value.plugins,
      }),
    }).pipe(
      switchMap(() => this.refs.get(this._ref.url, this._ref.origin)),
      tap(ref => this.publishChanged = !published.isSame(ref.published)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.editing = false;
      this.ref = ref;
    });
  }

  delete() {
    (this.admin.status.plugins.delete
      ? this.refs.update(deleteNotice(this._ref))
      : this.refs.delete(this._ref.url, this._ref.origin)
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(() => {
      this.serverError = [];
      this.deleting = false;
      this.deleted = true;
    });
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }
}
