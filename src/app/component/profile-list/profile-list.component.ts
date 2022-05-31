import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Page } from '../../model/page';

@Component({
  selector: 'app-profile-list',
  templateUrl: './profile-list.component.html',
  styleUrls: ['./profile-list.component.scss']
})
export class ProfileListComponent implements OnInit {
  @HostBinding('class') css = 'profile-list';

  private _page!: Page<string> | null;

  constructor(private router: Router) { }

  get page(): Page<string> | null {
    return this._page;
  }

  @Input()
  set page(value: Page<string> | null) {
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
