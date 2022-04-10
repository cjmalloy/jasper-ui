import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { Ext } from '../../model/ext';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sidebar';
  private destroy$ = new Subject<void>();

  @Input()
  ext?: Ext | null;
  @Input()
  tag?: string | null;

  searchValue = '';
  writeAccess$?: Observable<boolean>;

  constructor(
    public router: Router,
    public route: ActivatedRoute,
    public admin: AdminService,
    public account: AccountService,
  ) {
    this.route.queryParams.subscribe(params => this.searchValue = params['search']);
  }

  ngOnInit(): void {
    this.writeAccess$ = this.account.writeAccessTag(this.tag!);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get type() {
    if (this.queue) return this.admin.status.templates.queue!.name || this.admin.status.templates.queue!.tag;
    if (this.user) return this.admin.status.templates.user!.name || this.admin.status.templates.user!.tag;
    if (this.root) return this.admin.status.templates.root!.name || this.admin.status.templates.root!.tag;
    return '';
  }

  get root() {
    return !!this.admin.status.templates.root && !!this.tag;
  }

  get user() {
    return !!this.admin.status.templates.user && (
      this.tag?.startsWith('user/') ||
      this.tag?.startsWith('_user/'));
  }

  get queue() {
    return !!this.admin.status.templates.queue && (
      this.tag?.startsWith('queue/') ||
      this.tag?.startsWith('_queue/'));
  }

  search() {
    this.router.navigate([], { queryParams: { search: this.searchValue }, queryParamsHandling: 'merge' });
  }

}
