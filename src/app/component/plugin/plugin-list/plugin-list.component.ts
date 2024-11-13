import { Component, HostBinding, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Page } from '../../../model/page';
import { Tag } from '../../../model/tag';

@Component({
  selector: 'app-plugin-list',
  templateUrl: './plugin-list.component.html',
  styleUrls: ['./plugin-list.component.scss']
})
export class PluginListComponent {
  @HostBinding('class') css = 'plugin-list';

  private _page?: Page<Tag>;

  constructor(private router: Router) { }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<Tag> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.page.number > 0 && this._page.page.number >= this._page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.page.totalPages - 1
          },
          queryParamsHandling: "merge",
        });
      }
    }
  }

  ngOnInit(): void {
  }
}
