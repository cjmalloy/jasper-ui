import { Component, ElementRef, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { uniq, uniqBy } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, filter, forkJoin, map, Observable, of, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { hydrate } from '../../model/tag';
import { getTemplateScope, Template } from '../../model/template';
import { getMailbox } from '../../mods/mailbox';
import { RootConfig } from '../../mods/root';
import { UserConfig } from '../../mods/user';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';
import { TemplateService } from '../../service/api/template.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';
import { hasPrefix, hasTag, localTag, tagOrigin, topAnds } from '../../util/tag';

type Exts = { ext: Ext, children: Ext[], more: boolean };

@Component({
  standalone: false,
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  host: {'class': 'sidebar'}
})
export class SidebarComponent implements OnInit, OnChanges, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  @Input()
  tag = '';
  @Input()
  activeExts: Ext[] = [];
  @Input()
  showToggle = true;
  @Input()
  home = false;
  @Input()
  @HostBinding('class.floating')
  floating = true;

  localTag?: string;
  addTags: string[] = this.rootConfig?.addTags || ['public'];
  defaultThumbnail = this.rootConfig?.defaultThumbnail;
  plugin?: Plugin;
  mailPlugin?: Plugin;
  tagTemplate?: Template;
  template?: Template;
  writeAccess = false;
  ui: Template[] = [];
  genUrl = 'internal:' + uuid();
  bookmarkExts: Ext[] = [];
  tagSubExts: Ext[] = [];
  userSubExts: Ext[] = [];

  @HostBinding('class.expanded')
  private _expanded = false;
  private _ext?: Ext;
  private lastView = this.store.view.current;

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    public config: ConfigService,
    private auth: AuthzService,
    private account: AccountService,
    public ts: TaggingService,
    private exts: ExtService,
    private templates: TemplateService,
    private el: ElementRef,
  ) {
    if (localStorage.getItem('sidebar-expanded') !== null) {
      this.expanded = localStorage.getItem('sidebar-expanded') !== 'false';
    } else {
      this.expanded = !!window.matchMedia('(min-width: 1024px)').matches;
    }

    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => {
      if (hasTag('plugin/chat', this.store.view.ref)) return;
      if (this.config.tablet && this.lastView != this.store.view.current ||
          !this.config.huge  && this.store.view.current === 'ref/summary') {
        this.lastView = this.store.view.current;
        this.expanded = false;
      }
    });
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.expanded = this.store.view.sidebarExpanded;
    }));
    this.disposers.push(autorun(() => {
      if (!this.store.view.template) {
        this.template = undefined;
      } else if (this.template?.tag !== this.store.view.template) {
        this.templates.get(this.store.view.template + this.store.account.origin).pipe(
          catchError(() => of(undefined))
        ).subscribe(t => this.template = t);
      }
    }));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.home || changes.tag || changes.ext) {
      MemoCache.clear(this);
      if (this.ext) {
        this.bookmarks$.subscribe(xs => this.bookmarkExts = xs);
        this.tagSubs$.subscribe(xs => this.tagSubExts = xs);
        this.userSubs$.subscribe(xs => this.userSubExts = xs);
        this.tag ||= this.ext.tag || '';
      } else {
        this.bookmarkExts = [];
        this.tagSubExts = [];
        this.userSubExts = [];
      }
      if (this.tag) {
        this.localTag = localTag(this.tag);
        this.plugin = this.admin.getPlugin(this.tag);
        if (this.home) {
          this.addTags = this.rootConfig?.addTags || this.plugin?.config?.reply || ['public'];
        } else if (this.plugin) {
          this.addTags = uniq([...this.rootConfig?.addTags || this.plugin?.config?.reply || ['public'], ...this.plugin?.config?.submit ? [this.plugin.tag] : []]);
        } else {
          this.addTags = uniq([...this.rootConfig?.addTags || ['public'], ...topAnds(this.tag).map(localTag)]);
        }
        this.defaultThumbnail = this.rootConfig?.defaultThumbnail;
        this.mailPlugin = this.admin.getPlugin(getMailbox(this.tag, this.store.account.origin));
        this.tagTemplate = this.admin.getTemplate(this.tag);
        this.writeAccess = this.auth.tagWriteAccess(this.tag);
        this.ui = this.admin.getTemplateUi(this.tag);
      } else {
        this.localTag = undefined;
        this.addTags = this.rootConfig?.addTags || this.plugin?.config?.reply || ['public'];
        this.plugin = undefined;
        this.mailPlugin = undefined;
        this.tagTemplate = undefined;
        this.writeAccess = false;
        this.ui = [];
      }
      this.addTags = this.addTags.filter(t => this.auth.canAddTag(t));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @memo
  get local() {
    return !this.existing || this.ext?.origin === this.store.account.origin;
  }

  get ext(): Ext | undefined {
    return this._ext;
  }

  @Input()
  set ext(value: Ext | undefined) {
    this._ext = value;
    runInAction(() => this.store.view.floatingSidebar = !value?.config?.noFloatingSidebar && value?.config?.defaultCols === undefined);
  }

  get existing() {
    return this.ext?.modified;
  }

  get expanded(): boolean {
    return this._expanded;
  }

  @Input()
  set expanded(value: boolean) {
    localStorage.setItem('sidebar-expanded', ''+value);
    this._expanded = value;
    runInAction(() => this.store.view.sidebarExpanded = value);
  }

  @memo
  get root() {
    return !!this.admin.getTemplate('');
  }

  @memo
  get rootConfig() {
    if (!this.root) return undefined;
    return (this.ext?.config || this.tagTemplate?.defaults || this.admin.getTemplate('')!.defaults) as RootConfig;
  }

  @memo
  get modmail() {
    return !this.store.view.query && this.rootConfig?.modmail;
  }

  @memo
  get dm() {
    return this.admin.getTemplate('dm') && this.store.view.current === 'inbox/dms';
  }

  @memo
  get dms() {
    return uniq([
      ...this.plugin?.config?.reply ? [ this.plugin.tag ] : [],
      ...this.rootConfig?.dms ? [this.rootConfig?.dms] : [],
    ]);
  }

  @memo
  get canAddTag() {
    return !this.plugin?.tag || this.auth.canAddTag(this.plugin.tag);
  }

  get chat() {
    return !!this.admin.getPlugin('plugin/chat') && hasTag('plugin/chat', this.store.view.ref);
  }

  @memo
  get user() {
    return !this.store.view.query && !!this.admin.getTemplate('user') && hasPrefix(this.tag, 'user') && !this.store.view.userTemplate;
  }

  @memo
  get userConfig() {
    if (!this.user && !this.home) return null;
    return this.store.account.ext?.config as UserConfig;
  }

  @memo
  get bookmarks$() {
    return this.exts.getCachedExts(this.userConfig?.bookmarks || []).pipe(this.admin.extFallbacks);
  }

  @memo
  get userSubs() {
    return this.userConfig?.subscriptions?.filter((s: string) => hasPrefix(s, 'user'));
  }

  @memo
  get userSubs$() {
    return this.exts.getCachedExts(this.userSubs || []).pipe(this.admin.extFallbacks);
  }

  @memo
  get tagSubs() {
    return this.userConfig?.subscriptions?.filter((s: string) => !hasPrefix(s, 'user'));
  }

  @memo
  get tagSubs$() {
    return this.exts.getCachedExts(this.tagSubs || []).pipe(this.admin.extFallbacks);
  }

  @memo
  get queryExts$() {
    if (!this.store.view.exts.length) return of([]);
    return forkJoin(this.store.view.exts.map(ext => this.exts.page({
      query: ext.tag,
      sort: ['origin', 'levels', 'tag', 'modified,DESC'],
      size: ext.config?.childTags || 5,
    }).pipe(
      map(page => ({
        ext: ext,
        children: uniqBy(page.content, c => c.tag).filter(c => c.tag !== ext.tag),
        more: page.page.totalPages > 1,
      })),
      map(ext => ext.children.length ? ext : null),
      catchError(() => of(null))
    ))).pipe(
      map(exts => exts.filter(ext => !!ext)),
    ) as Observable<Exts[]>;
  }

  @memo
  get messages() {
    if (this.home) return false;
    if (!this.admin.getPlugin('plugin/inbox')) return false;
    if (!this.admin.getTemplate('dm')) return false;
    if (!this.store.account.user) return false;
    return this.dm || this.user || this.modmail || this.dms.length;
  }

  @memo
  get notes() {
    return this.admin.getTemplate('notes') && this.store.account.user;
  }

  @memo
  get homeWriteAccess() {
    return this.home && this.admin.getTemplate('home') && this.auth.tagWriteAccess('home');
  }

  @memo
  get uiMarkdown() {
    if (!this.ext) return '';
    return this.ui.map(t => hydrate(t.config, 'ui', getTemplateScope(this.store.account.roles, t, this.ext!, this.el.nativeElement))).join();
  }

  subscribe() {
    this.account.addSub(this.tag!);
  }

  unsubscribe() {
    this.account.removeSub(this.tag!);
  }

  bookmark() {
    this.account.addBookmark(this.tag!);
  }

  removeBookmark() {
    this.account.removeBookmark(this.tag!);
  }

  addAlarm() {
    this.account.addAlarm(this.tag!);
  }

  removeAlarm() {
    this.account.removeAlarm(this.tag!);
  }

  get inSubs() {
    return this.store.account.subs.includes(this.tag!);
  }

  get inBookmarks() {
    return this.store.account.bookmarks.includes(this.tag!);
  }

  get inAlarms() {
    return this.store.account.alarms.includes(this.tag!);
  }

  set showRemotes(value: boolean) {
    this.router.navigate([], { queryParams: { showRemotes: value ? true : null }, queryParamsHandling: 'merge' })
  }

  startChat() {
    runInAction(() => this.store.view.ref?.tags?.push('plugin/chat'));
    this.ts.create('plugin/chat', this.store.view.ref!.url, this.store.account.origin).subscribe()
  }
}
