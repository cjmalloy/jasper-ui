import { Component, Input, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of, Subject, takeUntil } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RootConfig } from '../../mods/root';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { BlogEntryComponent } from './blog-entry/blog-entry.component';

@Component({
  standalone: false,
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss'],
  host: {'class': 'blog ext'}
})
export class BlogComponent implements HasChanges, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input()
  pageControls = true;
  @Input()
  emptyMessage = $localize`No blog entries found`;

  pinned: Ref[] = [];
  colStyle = '';
  error: any;

  @ViewChildren(BlogEntryComponent)
  list?: QueryList<BlogEntryComponent>;

  private _page?: Page<Ref>;
  private _ext?: Ext;
  private _cols? = 0;

  constructor(
    private router: Router,
    private store: Store,
    private refs: RefService,
  ) { }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  saveChanges() {
    return !this.list?.find(r => !r.saveChanges());
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set cols(value: number | undefined) {
    this._cols = value;
    if (!value) {
      this.colStyle = '';
    } else {
      this.colStyle = ' 1fr'.repeat(value);
    }
  }

  get cols() {
    if (this._cols) return this._cols;
    return this.config?.defaultCols;
  }

  get ext() {
    return this._ext;
  }

  get config() {
    return this.ext?.config as RootConfig | undefined;
  }

  @Input()
  set ext(value: Ext | undefined) {
    this._ext = value;
    if (!value?.config?.pinned?.length) {
      this.pinned = [];
    } else {
      forkJoin((value.config.pinned as string[])
        .map(pin => this.refs.getCurrent(pin).pipe(
          catchError(err => of({url: pin})),
          takeUntil(this.destroy$),
        )))
        .subscribe(pinned => this.pinned = pinned);
    }
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.page.number > 0 && this._page.page.number >= this._page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.page.totalPages - 1
          },
          queryParamsHandling: "merge",
        })
      }
    }
  }

}
