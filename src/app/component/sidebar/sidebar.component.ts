import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, filter, of, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Template } from '../../model/template';
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
import { hasPrefix, localTag, prefix, tagOrigin, topAnds } from '../../util/tag';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sidebar';
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();
  prefix = prefix;

  @Input()
  showToggle = true;
  @Input()
  home = false;
  @Input()
  @HostBinding('class.floating')
  floating = true;

  _tag = '';
  _ext?: Ext;
  localTag?: string;
  addTags = this.admin.getTemplate('')?.defaults?.addTags || [];
  local = true;
  plugin?: Plugin;
  mailPlugin?: Plugin;
  template?: Template;
  writeAccess = false;
  ui: Template[] = [];
  genUrl = 'internal:' + uuid();
  bookmarkExts: Ext[] = [];
  tagSubExts: Ext[] = [];
  userSubExts: Ext[] = [];

  @HostBinding('class.expanded')
  private _expanded = false;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
    public config: ConfigService,
    private auth: AuthzService,
    private account: AccountService,
    private exts: ExtService,
    private templates: TemplateService,
  ) {
    if (localStorage.getItem('sidebar-expanded') !== null) {
      this._expanded = localStorage.getItem('sidebar-expanded') !== 'false';
    } else {
      this._expanded = !!window.matchMedia('(min-width: 1024px)').matches;
    }
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
    ).subscribe(() => {
      if (this.config.mobile || this.store.view.current === 'ref/summary') {
        this.expanded = false;
      }
    });
  }

  get tag() {
    return this._tag;
  }

  @Input()
  set tag(value: string) {
    this._tag = value;
    if (value) {
      const origin = tagOrigin(value);
      this.local = !origin || origin === this.store.account.origin;
      this.localTag = localTag(value);
      this.plugin = this.admin.getPlugin(value);
      if (this.home) {
        this.addTags = this.rootConfig?.addTags || [];
      } else {
        this.addTags = uniq([...this.rootConfig?.addTags || (this.plugin?.tag ? [this.plugin!.tag] : []), ...topAnds(value).map(localTag)]);
      }
      this.mailPlugin = this.admin.getPlugin(getMailbox(value, this.store.account.origin));
      this.writeAccess = this.auth.tagWriteAccess(value);
      this.ui = this.admin.getTemplateUi(value);
    } else {
      this.local = true;
      this.localTag = undefined;
      this.addTags = this.rootConfig?.addTags || [];
      this.plugin = undefined;
      this.mailPlugin = undefined;
      this.writeAccess = false;
      this.ui = [];
    }
  }

  get ext(): Ext | undefined {
    return this._ext;
  }

  @Input()
  set ext(value: Ext | undefined) {
    this._ext = value;
    if (value) {
      this.bookmarks$.subscribe(xs => this.bookmarkExts = xs);
      this.tagSubs$.subscribe(xs => this.tagSubExts = xs);
      this.userSubs$.subscribe(xs => this.userSubExts = xs);
    } else {
      this.bookmarkExts = [];
      this.tagSubExts = [];
      this.userSubExts = [];
    }
    this.tag = value?.tag || '';
  }

  get expanded(): boolean {
    return this._expanded;
  }

  @Input()
  set expanded(value: boolean) {
    localStorage.setItem('sidebar-expanded', ''+value);
    this._expanded = value;
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      if (!this.store.view.template) {
        this.template = undefined;
      } else if (this.template?.tag !== this.store.view.template) {
        this.templates.get(this.store.view.template + this.store.account.origin).pipe(
          catchError(() => of(undefined))
        ).subscribe(t => this.template = t);
      }
    }))
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get root() {
    return !!this.admin.getTemplate('');
  }

  get rootConfig() {
    if (!this.root) return undefined;
    return (this._ext?.config || this.admin.getTemplate('')!.defaults) as RootConfig;
  }


  get modmail() {
    return this._ext?.config?.modmail;
  }

  get user() {
    return !!this.admin.getTemplate('user') && hasPrefix(this._tag, 'user') && !this.store.view.userTemplate;
  }

  get userConfig() {
    if (!this.user && !this.home) return null;
    return this.store.account.ext?.config as UserConfig;
  }

  get bookmarks$() {
    return this.exts.getCachedExts(this.userConfig?.bookmarks || []).pipe(this.admin.extFallbacks);
  }

  get userSubs() {
    return this.userConfig?.subscriptions?.filter((s: string) => hasPrefix(s, 'user'));
  }

  get userSubs$() {
    return this.exts.getCachedExts(this.userSubs || []).pipe(this.admin.extFallbacks);
  }

  get tagSubs() {
    return this.userConfig?.subscriptions?.filter((s: string) => !hasPrefix(s, 'user'));
  }

  get tagSubs$() {
    return this.exts.getCachedExts(this.tagSubs || []).pipe(this.admin.extFallbacks);
  }

  get messages() {
    if (this.home) return false;
    if (!this.admin.getPlugin('plugin/inbox')) return false;
    if (!this.admin.getTemplate('dm')) return false;
    if (!this.store.account.user) return false;
    return this.user || this.modmail;
  }

  get homeWriteAccess() {
    return this.home && this.admin.getTemplate('home') && this.auth.tagWriteAccess('home');
  }

  subscribe() {
    this.account.addSub(this._tag!);
  }

  unsubscribe() {
    this.account.removeSub(this._tag!);
  }

  bookmark() {
    this.account.addBookmark(this._tag!);
  }

  removeBookmark() {
    this.account.removeBookmark(this._tag!);
  }

  addAlarm() {
    this.account.addAlarm(this._tag!);
  }

  removeAlarm() {
    this.account.removeAlarm(this._tag!);
  }

  get inSubs() {
    return this.store.account.subs.includes(this._tag!);
  }

  get inBookmarks() {
    return this.store.account.bookmarks.includes(this._tag!);
  }

  get inAlarms() {
    return this.store.account.alarms.includes(this._tag!);
  }

  set showRemotes(value: boolean) {
    this.router.navigate([], { queryParams: { showRemotes: value ? true : null }, queryParamsHandling: 'merge' })
  }
}
