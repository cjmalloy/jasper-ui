import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { Ext } from '../../model/ext';
import { Template } from '../../model/template';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { AuthService } from '../../service/auth.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { TAG_REGEX } from '../../util/format';
import { localTag, prefix, removeWildcard } from '../../util/tag';

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
  ext?: Ext | null;
  @Input()
  showToggle = true;
  @Input()
  home = false;
  @Input()
  showSort = true;
  @Input()
  type?: 'ref' | 'tag' = 'ref';

  _tag = '';
  localTag?: string;
  writeAccess = false;
  ui: Template[] = [];

  @HostBinding('class.expanded')
  private _expanded = false;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public admin: AdminService,
    public store: Store,
    public config: ConfigService,
    private auth: AuthService,
    private account: AccountService,
  ) {
    if (localStorage.getItem('sidebar-expanded') !== null) {
      this._expanded = localStorage.getItem('sidebar-expanded') === 'true';
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
      this.localTag = localTag(removeWildcard(value));
      this.writeAccess = this.auth.tagWriteAccess(removeWildcard(value));
      this.ui = this.admin.getTemplateUi(value);
    } else {
      this.localTag = undefined;
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

  get feed() {
    return this.admin.status.plugins.feed && (this.store.account.mod || this.auth.tagReadAccess('+plugin/feed'));
  }

  get modmail(): string | null {
    if (!this._tag) return null;
    if (!TAG_REGEX.test(this._tag)) return null;
    if (this._tag.startsWith('plugin')) return null;
    return this._tag;
  }

  get isApprover() {
    return this.ext?.config?.approvers?.includes(this.store.account.localTag);
  }

  get user() {
    return !!this.admin.status.templates.user && (
      this._tag?.startsWith('+user/') ||
      this._tag?.startsWith('_user/'));
  }

  get queue() {
    return !!this.admin.status.templates.queue && (
      this._tag?.startsWith('queue/') ||
      this._tag?.startsWith('_queue/') ||
      this._tag?.startsWith('+queue/'));
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

  get inSubs() {
    return this.store.account.subs.includes(this._tag!);
  }

  get inBookmarks() {
    return this.store.account.bookmarks.includes(this._tag!);
  }
}
