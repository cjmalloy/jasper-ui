import { ChangeDetectionStrategy, Component, inject, Input, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { ExtComponent } from '../ext.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private router = inject(Router);


  readonly list = viewChildren(ExtComponent);

  private _page?: Page<Ext>;

  saveChanges() {
    return !this.list()?.find(r => !r.saveChanges());
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
