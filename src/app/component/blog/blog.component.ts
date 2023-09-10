import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { ExtService } from '../../service/api/ext.service';
import { runInAction } from 'mobx';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit {
  @HostBinding('class') css = 'blog ext';

  @Input()
  pageControls = true;
  @Input()
  emptyMessage = $localize`No blog entries found`;

  pinned: Ref[] = [];
  colStyle = '';
  error: any;

  private _page?: Page<Ref>;
  private _ext?: Ext;
  private _cols = 0;

  constructor(
    private router: Router,
    private store: Store,
    private refs: RefService,
  ) { }

  trackByUrlOrigin(index: number, value: Ref) {
    return value.origin + '@' + value.url;
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set cols(value: number) {
    this._cols = value;
    if (!value) {
      this.colStyle = '';
    } else {
      this.colStyle = ' 1fr'.repeat(value);
    }
  }

  get cols() {
    return this._cols;
  }

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

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.number > 0 && this._page.number >= this._page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.totalPages - 1
          },
          queryParamsHandling: "merge",
        })
      }
    }
  }

  ngOnInit(): void {
  }

}
