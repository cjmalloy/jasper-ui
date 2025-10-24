import { Component, Input, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { ExtComponent } from '../ext.component';

@Component({
  selector: 'app-ext-list',
  templateUrl: './ext-list.component.html',
  styleUrls: ['./ext-list.component.scss'],
  host: { 'class': 'ext-list' },
  imports: [
    ExtComponent,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class ExtListComponent implements HasChanges {

  @ViewChildren(ExtComponent)
  list?: QueryList<ExtComponent>;

  private _page?: Page<Ext>;

  constructor(private router: Router) { }

  saveChanges() {
    return !this.list?.find(r => !r.saveChanges());
  }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<Ext> | undefined) {
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
