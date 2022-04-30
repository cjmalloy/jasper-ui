import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Origin } from '../../model/origin';
import { Page } from '../../model/page';

@Component({
  selector: 'app-origin-list',
  templateUrl: './origin-list.component.html',
  styleUrls: ['./origin-list.component.scss'],
})
export class OriginListComponent implements OnInit {
  @HostBinding('class') css = 'origin-list';

  private _page!: Page<Origin> | null;

  constructor(private router: Router) { }

  get page(): Page<Origin> | null {
    return this._page;
  }

  @Input()
  set page(value: Page<Origin> | null) {
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
