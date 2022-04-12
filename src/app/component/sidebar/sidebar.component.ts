import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable, Subject } from 'rxjs';
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
  tag?: string | null;

  localTag?: string;
  writeAccess$?: Observable<boolean>;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public admin: AdminService,
    public account: AccountService,
  ) { }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccessTag(this.tag!);
    if (this.tag) {
      this.localTag = localTag(this.tag);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get inSubs$() {
    return this.account.userExt$.pipe(map(ext => ext.config.subscriptions.includes(this.tag)));
  }

  get root() {
    return !!this.admin.status.templates.root && !!this.tag;
  }

  get isApprover() {
    return this.ext?.config.approvers.includes(this.account.tag);
  }

  get user() {
    return !!this.admin.status.templates.user && (
      this.tag?.startsWith('+user/') ||
      this.tag?.startsWith('_user/'));
  }

  get queue() {
    return !!this.admin.status.templates.queue && (
      this.tag?.startsWith('queue/') ||
      this.tag?.startsWith('_queue/') ||
      this.tag?.startsWith('+queue/'));
  }

  subscribe() {
    this.account.subscribe(this.tag!);
  }

  unsubscribe() {
    this.account.unsubscribe(this.tag!);
  }
}
