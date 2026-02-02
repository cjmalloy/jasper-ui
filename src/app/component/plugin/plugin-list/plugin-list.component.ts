import { ChangeDetectionStrategy, Component, inject, Input, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Plugin } from '../../../model/plugin';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { PluginComponent } from '../plugin.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-plugin-list',
  templateUrl: './plugin-list.component.html',
  styleUrls: ['./plugin-list.component.scss'],
  host: { 'class': 'plugin-list' },
  imports: [PluginComponent, PageControlsComponent, LoadingComponent]
})
export class PluginListComponent implements HasChanges {
  private router = inject(Router);


  readonly list = viewChildren(PluginComponent);

  private _page?: Page<Plugin>;

  saveChanges() {
    return !this.list()?.find(p => !p.saveChanges());
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
