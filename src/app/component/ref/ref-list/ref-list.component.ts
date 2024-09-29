import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, forkJoin, Observable, of, Subject, takeUntil } from 'rxjs';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { score } from '../../../mods/vote';
import { AccountService } from '../../../service/account.service';
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
  showToggle = true;
  @Input()
  expandInline = false;
  @Input()
  showVotes = false;
  @Input()
  hideNewZeroVoteScores = true;
  @Input()
  newRefs$?: Observable<Ref | null>;
  @Input()
  insertNewAtTop = false;
  @Input()
  showPrev = true;

  pinned: Ref[] = [];
  newRefs: Ref[] = [];

  private _page?: Page<Ref>;
  private _ext?: Ext;
  private _expanded?: boolean;
  private _cols = 0;

  constructor(
    private accounts: AccountService,
    private router: Router,
    private store: Store,
    private refs: RefService,
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
        .map(pin => this.refs.getCurrent(pin).pipe(
          catchError(err => of({ url: pin }))
        )))
        .subscribe(pinned => this.pinned = pinned);
    }
  }

  @Input()
  set cols(value: number | undefined) {
    this._cols = value || 0;
  }

  get colStyle() {
    if (!this.cols) {
      return '';
    } else {
      return ' 1fr'.repeat(this.cols);
    }
  }

  get cols() {
    if (this._cols) return this._cols;
    return this.ext?.config?.defaultCols;
  }

  get expanded(): boolean {
    if (this._expanded === undefined) return this._ext?.config?.defaultExpanded;
    return this._expanded;
  }

  @Input()
  set expanded(value: boolean) {
    this._expanded = value;
  }

  get page(): Page<Ref> | undefined {
    return this._page;
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
    ).subscribe(ref => ref && this.addNewRef(ref));
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

  addNewRef(ref: Ref) {
    // TODO: verify read before clearing?
    this.accounts.clearNotificationsIfNone(ref.modified);
    if (!this.page?.content.find(r => r.url === ref.url)) {
      const index = this.newRefs.findIndex(r => r.url === ref.url);
      if (index !== -1) {
        this.newRefs[index] = ref;
      } else if (this.insertNewAtTop) {
        this.newRefs.unshift(ref);
        return;
      } else {
        this.newRefs.push(ref);
        return;
      }
    }
    this.store.eventBus.refresh(ref);
    this.store.eventBus.reset();
  }
}
