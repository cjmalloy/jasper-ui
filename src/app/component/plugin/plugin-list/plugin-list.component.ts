import { Component, Input, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Plugin } from '../../../model/plugin';
import { PluginComponent } from '../plugin.component';

@Component({
  standalone: false,
  selector: 'app-plugin-list',
  templateUrl: './plugin-list.component.html',
  styleUrls: ['./plugin-list.component.scss'],
  host: {'class': 'plugin-list'}
})
export class PluginListComponent implements HasChanges {

  @ViewChildren(PluginComponent)
  list?: QueryList<PluginComponent>;

  private _page?: Page<Plugin>;

  constructor(private router: Router) { }

  saveChanges() {
    return !this.list?.find(p => !p.saveChanges());
  }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<Plugin> | undefined) {
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
}
