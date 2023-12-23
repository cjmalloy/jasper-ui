import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
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
export class SidebarComponent implements OnInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'sidebar';
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();
  prefix = prefix;

  @Input()
  tag = '';
  @Input()
  ext?: Ext;
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
  addTags = this.admin.getTemplate('')?.defaults?.addTags || [];
  defaultThumbnail = this.admin.getTemplate('')?.defaults?.defaultThumbnail;
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes.home || changes.tag || changes.ext) {
      if (this.ext) {
        this.bookmarks$.subscribe(xs => this.bookmarkExts = xs);
        this.tagSubs$.subscribe(xs => this.tagSubExts = xs);
        this.userSubs$.subscribe(xs => this.userSubExts = xs);
        this.tag = this.ext.tag || '';
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
          this.addTags = this.rootConfig?.addTags || ['public'];
        } else {
          this.addTags = uniq([...this.rootConfig?.addTags || ['public'], ...topAnds(this.tag).map(localTag)]);
        }
        this.defaultThumbnail = this.rootConfig?.defaultThumbnail;
        this.mailPlugin = this.admin.getPlugin(getMailbox(this.tag, this.store.account.origin));
        this.writeAccess = this.auth.tagWriteAccess(this.tag);
        this.ui = this.admin.getTemplateUi(this.tag);
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get expanded(): boolean {
    return this._expanded;
  }

  @Input()
  set expanded(value: boolean) {
    localStorage.setItem('sidebar-expanded', ''+value);
    this._expanded = value;
  }

  get root() {
    return !!this.admin.getTemplate('');
  }

  get rootConfig() {
    if (!this.root) return undefined;
    return (this.ext?.config || this.admin.getTemplate('')!.defaults) as RootConfig;
  }


  get modmail() {
    return this.ext?.config?.modmail;
  }

  get user() {
    return !!this.admin.getTemplate('user') && hasPrefix(this.tag, 'user') && !this.store.view.userTemplate;
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
