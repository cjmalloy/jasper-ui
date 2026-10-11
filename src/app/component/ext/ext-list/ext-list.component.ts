import { Component, effect, inject, input, viewChildren } from '@angular/core';
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
  private router = inject(Router);


  readonly list = viewChildren(ExtComponent);

  readonly page = input<Page<Ext> | undefined>(undefined);

  constructor() {
    effect(() => {
      const page = this.page();
      if (page && page.page.number !== undefined && page.page.number > 0 && page.page.number >= page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: page.page.totalPages - 1
          },
          queryParamsHandling: "merge",
        })
      }
    });
  }

  saveChanges() {
    return !this.list()?.find(r => !r.saveChanges());
  }

}
