import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';

@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss'],
})
export class RefListComponent implements OnInit {
  @HostBinding('class') css = 'ref-list';

  @Input()
  pinned?: Ref[] | null;
  @Input()
  tag?: string | null;
  @Input()
  graph = false;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';

  private _page?: Page<Ref>;

  constructor(private router: Router) { }

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
          queryParamsHandling: "merge",
        })
      }
    }
  }

  ngOnInit(): void {
  }

}
