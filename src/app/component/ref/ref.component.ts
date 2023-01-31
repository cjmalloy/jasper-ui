import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { writePlugins } from '../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { Action, active, Icon, Visibility, visible } from '../../model/plugin';
import { Ref } from '../../model/ref';
import { deleteNotice } from '../../plugin/delete';
import { ActionService } from '../../service/action.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ScrapeService } from '../../service/api/scrape.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import {
  authors,
  clickableLink,
  formatAuthor,
  interestingTags,
  TAGS_REGEX,
  templates,
  urlSummary
} from '../../util/format';
import { printError } from '../../util/http';
import { hasTag, isOwnerTag, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefComponent implements OnInit {
  css = 'ref list-item ';
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
  icons: Icon[] = [];
  actions: Action[] = [];
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
    private acts: ActionService,
    private scraper: ScrapeService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = refForm(fb);
  }

  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this._ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '-'))
      .join(' ');
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
    this.icons = this.admin.getIcons(value.tags || []);
    this.actions = this.admin.getActions(value.tags || []).filter(a => a.response || this.auth.tagReadAccess(a.tag));
    this.expandPlugins = this.admin.getEmbeds(value.tags || []);
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

  private runAndLoad(observable: Observable<any>) {
    observable.pipe(
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
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
      hasTag('plugin/thumbnail', this.ref);
  }

  get person() {
    return this.admin.status.plugins.person &&
      hasTag('plugin/person', this.ref);
  }

  get canInvoice() {
    if (this.ref.origin) return false;
    if (!this.admin.status.plugins.invoice) return false;
    if (!this.isAuthor) return false;
    if (!this.ref.sources || !this.ref.sources.length) return false;
    return hasTag('plugin/comment', this.ref) ||
      !hasTag('internal', this.ref);
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
    return 'https://archive.ph/newest/' + this.ref.url;
  }

  get isAuthor() {
    return isOwnerTag(this.store.account.tag, this.ref);
  }

  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  get authors() {
    return authors(this.ref);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get host() {
    return urlSummary(this.ref.url);
  }

  get clickableLink() {
    return clickableLink(this.ref);
  }

  get comments() {
    if (!this.admin.status.plugins.comment) return 0;
    return this.ref.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get responses() {
    return this.ref.metadata?.responses || 0;
  }

  get sources() {
    return this.ref.sources?.length || 0;
  }

  formatAuthor(user: string) {
    if (this.store.account.origin && tagOrigin(user) === this.store.account.origin) {
      user = user.replace(this.store.account.origin, '');
    }
    return formatAuthor(user);
  }

  addInlineTag(field: HTMLInputElement) {
    if (field.validity.patternMismatch) {
      this.serverError = [$localize`
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not start with a forward slash or period.
        Must not or contain two forward slashes or periods in a row.
        Protected tags start with a plus sign.
        Private tags start with an underscore.`];
      return;
    }
    this.runAndLoad(this.ts.create(field.value, this.ref.url, this.ref.origin!));
  }

  visible(v: Visibility) {
    return visible(v, this.isAuthor, this.isRecipient);
  }

  active(a: Action | Icon) {
    return active(this.ref, a);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  showAction(a: Action) {
    if (a.tag && !this.writeAccess) return false;
    if (!this.visible(a)) return false;
    if (this.active(a) && !a.labelOn) return false;
    if (!this.active(a) && !a.labelOff) return false;
    return true;
  }

  doAction(a: Action) {
    this.runAndLoad(this.acts.apply(this.ref, a));
  }

  scrape() {
    this.runAndLoad(this.scraper.feed(this.ref.url, this.ref.origin!));
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
      switchMap(() => this.refs.get(this.ref.url, this.ref.origin)),
      tap(ref => this.publishChanged = !published.isSame(ref.published)),
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(ref => {
      this.serverError = [];
      this.ref = ref;
    });
  }

  delete() {
    (this.admin.status.plugins.delete
      ? this.refs.update(deleteNotice(this.ref))
      : this.refs.delete(this.ref.url, this.ref.origin)
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
