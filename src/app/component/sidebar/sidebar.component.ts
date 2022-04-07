import { Component, HostBinding, Input, OnDestroy, OnInit } from "@angular/core";
import { AccountService } from "../../service/account.service";
import { Ext } from "../../model/ext";
import { Subject } from "rxjs";

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sidebar';
  private destroy$ = new Subject<void>()

  @Input()
  ext?: Ext | null;
  @Input()
  tag?: string | null;

  constructor(
    public account: AccountService,
  ) { }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
