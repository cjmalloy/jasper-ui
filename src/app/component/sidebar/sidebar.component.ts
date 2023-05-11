import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Ext } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Template } from '../../model/template';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { hasPrefix, localTag, prefix, tagOrigin } from '../../util/tag';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sidebar';
  private destroy$ = new Subject<void>();
  prefix = prefix;

  @Input()
  ext?: Ext;
  @Input()
  showToggle = true;
  @Input()
  home = false;
  @Input()
  @HostBinding('class.floating')
  floating = true;

  _tag = '';
  localTag?: string;
  local = true;
  plugin?: Plugin;
  writeAccess = false;
  ui: Template[] = [];
  genUrl = 'internal:' + uuid();

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
  ) {
    if (localStorage.getItem('sidebar-expanded') !== null) {
      this._expanded = localStorage.getItem('sidebar-expanded') !== 'false';
    } else {
      this._expanded = !!window.matchMedia('(min-width: 1024px)').matches;
    }
  }

  get tag() {
    return this._tag;
  }

  @Input()
  set tag(value: string) {
    if (this._tag === value) return;
    this._tag = value;
    if (value) {
      const origin = tagOrigin(value);
      this.local = !origin || origin === this.store.account.origin;
      this.localTag = localTag(value);
      this.plugin = this.admin.getPlugin(value);
      this.writeAccess = this.auth.tagWriteAccess(value);
      this.ui = this.admin.getTemplateUi(value);
    } else {
      this.local = true;
      this.localTag = undefined;
      this.plugin = undefined;
      this.writeAccess = false;
      this.ui = [];
    }
  }

  get expanded(): boolean {
    return this._expanded;
  }

  @Input()
  set expanded(value: boolean) {
    localStorage.setItem('sidebar-expanded', ""+value);
    this._expanded = value;
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get root() {
    return !!this.admin.status.templates.root && !!this._tag;
  }

  get modmail() {
    return this.ext?.config?.modmail;
  }

  get isApprover() {
    return this.ext?.config?.approvers?.includes(this.store.account.localTag);
  }

  get user() {
    return !!this.admin.status.templates.user && hasPrefix(this._tag, 'user');
  }

  get bookmarks() {
    return this.exts.getCachedExts(this.ext?.config?.bookmarks || []);
  }

  get userSubs() {
    return this.exts.getCachedExts(this.ext?.config?.subscriptions?.filter((s: string) => hasPrefix(s, 'user')));
  }

  get tagSubs() {
    return this.exts.getCachedExts(this.ext?.config?.subscriptions?.filter((s: string) => !hasPrefix(s, 'user')));
  }

  get messages() {
    if (this.home) return false;
    if (!this.admin.status.plugins.inbox) return false;
    if (!this.admin.status.templates.dm) return false;
    if (!this.store.account.user) return false;
    return this.user || this.modmail;
  }

  get queue() {
    return !!this.admin.status.templates.queue && hasPrefix(this._tag, 'queue');
  }

  get homeWriteAccess() {
    return this.home && this.auth.tagWriteAccess('+home');
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
