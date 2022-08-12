import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Page } from '../../model/page';
import { IsTag } from '../../model/tag';

@Component({
  selector: 'app-tag-list',
  templateUrl: './tag-list.component.html',
  styleUrls: ['./tag-list.component.scss'],
})
export class TagListComponent implements OnInit {
  @HostBinding('class') css = 'tag-list';

  private _page?: Page<IsTag>;

  constructor(private router: Router) { }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<IsTag> | undefined) {
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
