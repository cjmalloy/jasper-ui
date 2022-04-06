import { Component, HostBinding, Input, OnDestroy, OnInit } from "@angular/core";
import { AccountService } from "../../service/account.service";
import { ExtService } from "../../service/ext.service";
import { Ext } from "../../model/ext";
import { capturesAny } from "../../util/tag";
import { mergeMap, Observable, Subject, takeUntil } from "rxjs";
import { tap } from "rxjs/operators";

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'sidebar';
  private destroy$ = new Subject<void>()

  @Input()
  tag$!: Observable<string>;

  tag?: string;
  ext?: Ext;
  writeAccess?: boolean;

  constructor(
    public account: AccountService,
    private exts: ExtService,
  ) { }

  ngOnInit(): void {
    this.tag$.pipe(
      takeUntil(this.destroy$),
      tap(tag => {
        this.tag = tag;
        if (this.account.mod) {
          this.writeAccess = true;
        } else {
          this.account.getMyUser()
          .subscribe(user => this.writeAccess = capturesAny(user.writeAccess, [tag]));
        }
      }),
      mergeMap(tag => this.exts.get(tag)),
    ).subscribe(ext => this.ext = ext);

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
