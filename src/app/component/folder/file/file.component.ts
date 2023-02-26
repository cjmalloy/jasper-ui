import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as moment from 'moment/moment';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { Action, active, Icon, Visibility, visible } from '../../../model/plugin';
import { Ref } from '../../../model/ref';
import { ActionService } from '../../../service/action.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { EditorService } from '../../../service/editor.service';
import { Store } from '../../../store/store';
import { downloadRef } from '../../../util/download';
import { authors, formatAuthor, interestingTags, TAGS_REGEX, templates, urlSummary } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag, isOwnerTag, tagOrigin } from '../../../util/tag';

@Component({
  selector: 'app-file',
  templateUrl: './file.component.html',
  styleUrls: ['./file.component.scss']
})
export class FileComponent implements OnInit {
  @HostBinding('class') css = 'file';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAGS_REGEX.source;

  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;

  expandPlugins: string[] = [];
  icons: Icon[] = [];
  actions: Action[] = [];
  publishedLabel = $localize`published`;
  tagging = false;
  editing = false;
  viewSource = false;
  deleting = false;
  writeAccess = false;
  serverError: string[] = [];

  private _ref!: Ref;

  constructor(
    public admin: AdminService,
    public store: Store,
    private router: Router,
    private auth: AuthzService,
    private editor: EditorService,
    private refs: RefService,
    private acts: ActionService,
    private scraper: ScrapeService,
    private ts: TaggingService,
  ) { }

  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '-'))
      .join(' ');
  }

  get ref(): Ref {
    return this._ref;
  }

  get origin() {
    return this.ref.origin || undefined;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.deleting = false;
    this.editing = false;
    this.viewSource = false;
    this.tagging = false;
    this.writeAccess = !hasTag('locked', value) && this.auth.writeAccess(value);
    this.icons = this.admin.getIcons(value.tags);
    this.actions = this.admin.getActions(value.tags, value.plugins).filter(a => a.response || this.auth.canAddTag(a.tag));
    this.publishedLabel = this.admin.getPublished(value.tags).join($localize`/`) || this.publishedLabel;
    this.expandPlugins = this.admin.getEmbeds(value.tags);
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

  get push() {
    return !!this.admin.status.plugins.originPush && hasTag('+plugin/origin/push', this.ref);
  }

  get pull() {
    return !!this.admin.status.plugins.originPull && hasTag('+plugin/origin/pull', this.ref);
  }

  get addTags() {
    if (this.feed) {
      return interestingTags(this.ref.plugins!['+plugin/feed'].addTags);
    }
    if (this.pull) {
      return interestingTags(this.ref.plugins?.['+plugin/origin']?.addTags);
    }
    return undefined;
  }

  get addOrigin() {
    if (this.feed) {
      return this.ref.plugins!['+plugin/feed'].origin;
    }
    if (this.remote) {
      return this.ref.plugins?.['+plugin/origin']?.local;
    }
    return undefined;
  }

  get scraped() {
    if (this.feed) {
      return !!this.ref.plugins!['+plugin/feed'].lastScrape;
    }
    if (this.pull) {
      return !!this.ref.plugins!['+plugin/origin/pull'].lastPulled;
    }
    return false;
  }

  get lastScrape() {
    if (this.feed) {
      return moment(this.ref.plugins!['+plugin/feed'].lastScrape);
    }
    if (this.pull) {
      return moment(this.ref.plugins!['+plugin/origin/pull'].lastPulled);
    }
    throw "Not scraped";
  }

  get thumbnail() {
    return this.admin.status.plugins.thumbnail &&
      hasTag('plugin/thumbnail', this.ref);
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

  get scrapeable() {
    return this.feed || this.pull;
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

  download() {
    downloadRef(this.ref);
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

  clickIcon(i: Icon) {
    if (i.response) {
      this.router.navigate([], { queryParams: { filter: this.store.view.toggleFilter(i.response) }, queryParamsHandling: 'merge' });
    }
    if (i.tag) {
      this.router.navigate(['/tag', this.store.view.toggleTag(i.tag)], { queryParamsHandling: 'merge' });
    }
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

  cssUrl(url: string) {
    return `url("${url}")`;
  }
}
