import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, of, Subject } from 'rxjs';
import { Ext } from '../../model/ext';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { localTag, prefix } from '../../util/tag';

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
  searchable = true;

  _tag: string | null = null;
  localTag?: string;
  writeAccess$ = of(false);
  inSubs$ = of(false);

  @HostBinding('class.expanded')
  private _expanded = false;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public admin: AdminService,
    public account: AccountService,
  ) {
    if (localStorage.getItem('sidebar-expanded') !== null) {
      this._expanded = localStorage.getItem('sidebar-expanded') === 'true';
    } else {
      this._expanded = !!window.matchMedia('(min-width: 1024px)').matches;
    }
  }

  get tag(): string | null {
    return this._tag;
  }

  @Input()
  set tag(value: string | null) {
    if (this._tag === value) return;
    this._tag = value;
    if (value) {
      this.inSubs$ =  this.account.subscriptions$.pipe(
        map(subs => subs.includes(value))
      );
      this.localTag = localTag(value);
      this.writeAccess$ = this.account.writeAccessTag(value);
    } else {
      this.localTag = undefined;
      this.writeAccess$ = of(false);
      this.inSubs$ = of(false);
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

  get isApprover() {
    return this.ext?.config.approvers.includes(this.account.tag);
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
    this.inSubs$ = of(true);
  }

  unsubscribe() {
    this.account.removeSub(this._tag!);
    this.inSubs$ = of(false);
  }
}
