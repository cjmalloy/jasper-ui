import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, forkJoin, Observable, of, Subject, takeUntil } from 'rxjs';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { score } from '../../../mods/vote';
import { Ext } from '../../../model/ext';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss'],
})
export class RefListComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'ref-list';
  private destroy$ = new Subject<void>();

  @Input()
  plugins?: string[];
  @Input()
  showPageLast = true;
  @Input()
  showAlarm = true;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';
  @Input()
  showVotes = false;
  @Input()
  hideNewZeroVoteScores = true;
  @Input()
  newRefs$?: Observable<Ref | null>;

  pinned: Ref[] = [];
  newRefs: Ref[] = [];

  private _page?: Page<Ref>;
  private _ext?: Ext;
  private _expanded?: boolean;

  constructor(
    private router: Router,
    private refs: RefService,
    private store: Store,
  ) { }

  get ext() {
    return this._ext;
  }

  @Input()
  set ext(value: Ext | undefined) {
    this._ext = value;
    if (!value?.config?.pinned?.length) {
      this.pinned = [];
    } else {
      forkJoin((value.config.pinned as string[])
        .map(pin => this.refs.get(pin, this.store.account.origin).pipe(
          catchError(err => of({url: pin}))
        )))
        .subscribe(pinned => this.pinned = pinned);
    }
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  get expanded(): boolean {
    if (this._expanded === undefined) return this._ext?.config?.defaultExpanded;
    return this._expanded;
  }

  @Input()
  set expanded(value: boolean) {
    this._expanded = value;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.number > 0 && this._page.number >= this._page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
    }
  }

  ngOnInit(): void {
    this.newRefs$?.pipe(
      takeUntil(this.destroy$),
    ).subscribe(ref => ref && this.newRefs.push(ref));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getNumber(i: number) {
    if (this.showVotes) {
      const votes = score(this.page!.content[i]);
      if (votes < 100 &&
        this.hideNewZeroVoteScores &&
        moment().diff(this.page!.content[i].created!, 'minutes') < 5) {
        return '•';
      }
      return votes;
    }
    return i + this.page!.number * this.page!.size + 1;
  }
}
