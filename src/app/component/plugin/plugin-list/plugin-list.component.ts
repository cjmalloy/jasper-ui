import { Component, effect, input, ChangeDetectionStrategy, viewChildren, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Plugin } from '../../../model/plugin';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { PluginComponent } from '../plugin.component';

@Component({
  selector: 'app-plugin-list',
  templateUrl: './plugin-list.component.html',
  styleUrls: ['./plugin-list.component.scss'],
  host: { 'class': 'plugin-list' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PluginComponent, PageControlsComponent, LoadingComponent]
})
export class PluginListComponent implements HasChanges {

  readonly list = viewChildren(PluginComponent);

  readonly page = input<Page<Plugin> | undefined>();

  constructor(private router: Router) {
    effect(() => {
      const value = this.page();
      untracked(() => this.checkPage(value));
    });
  }

  saveChanges() {
    return !this.list()?.find(p => !p.saveChanges());
  }

  private checkPage(page: Page<Plugin> | undefined) {
    if (page) {
      if (page.page.number > 0 && page.page.number >= page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: page.page.totalPages - 1
          },
          queryParamsHandling: "merge",
        });
      }
    }
  }
}
