import { Component, ElementRef, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, filter, of, Subject } from 'rxjs';
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
import { TemplateService } from '../../service/api/template.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';
import { hasPrefix, localTag, tagOrigin, topAnds } from '../../util/tag';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'sidebar';
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
  local = true;
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

  constructor(
    public router: Router,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    public config: ConfigService,
    private auth: AuthzService,
    private account: AccountService,
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
      if (this.config.mobile || this.store.view.current === 'ref/summary' && !window.matchMedia('(min-width: 1024px)').matches) {
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
        const origin = tagOrigin(this.tag);
        this.local = !origin || origin === this.store.account.origin;
        this.localTag = localTag(this.tag);
        this.plugin = this.admin.getPlugin(this.tag);
        if (this.home) {
          this.addTags = this.rootConfig?.addTags || this.plugin?.config?.reply || ['public'];
        } else {
          this.addTags = uniq([...this.rootConfig?.addTags || this.plugin?.config?.reply || ['public'], ...topAnds(this.tag).map(localTag)]);
        }
        this.defaultThumbnail = this.rootConfig?.defaultThumbnail;
        this.mailPlugin = this.admin.getPlugin(getMailbox(this.tag, this.store.account.origin));
        this.tagTemplate = this.admin.getTemplate(this.tag);
        this.writeAccess = this.auth.tagWriteAccess(this.tag);
        this.ui = this.admin.getTemplateUi(this.tag);
      } else {
        this.local = true;
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

  get ext(): Ext | undefined {
    return this._ext;
  }

  @Input()
  set ext(value: Ext | undefined) {
    this._ext = value;
    runInAction(() => this.store.view.floatingSidebar = !value?.config?.noFloatingSidebar && value?.config?.defaultCols === undefined);
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
    return this.rootConfig?.modmail;
  }

  @memo
  get dms() {
    return uniq([
      ...this.plugin?.config?.reply ? [ this.plugin.tag ] : [],
      ...this.rootConfig?.dms ? [this.rootConfig?.dms] : [],
    ]);
  }

  @memo
  get user() {
    return !!this.admin.getTemplate('user') && hasPrefix(this.tag, 'user') && !this.store.view.userTemplate;
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
  get messages() {
    if (this.home) return false;
    if (!this.admin.getPlugin('plugin/inbox')) return false;
    if (!this.admin.getTemplate('dm')) return false;
    if (!this.store.account.user) return false;
    return this.user || this.modmail || this.dms;
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
}
