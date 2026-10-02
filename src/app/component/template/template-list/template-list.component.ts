import { Component, effect, input, ChangeDetectionStrategy, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Template } from '../../../model/template';
import { LoadingComponent } from '../../loading/loading.component';
import { PageControlsComponent } from '../../page-controls/page-controls.component';
import { TemplateComponent } from '../template.component';

@Component({
  selector: 'app-template-list',
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.scss'],
  host: { 'class': 'template-list' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TemplateComponent, PageControlsComponent, LoadingComponent]
})
export class TemplateListComponent implements HasChanges {

  readonly list = viewChildren(TemplateComponent);

  readonly page = input<Page<Template> | undefined>();

  constructor(private router: Router) {
    effect(() => this.checkPage(this.page()));
  }

  saveChanges() {
    return !this.list()?.find(p => !p.saveChanges());
  }

  private checkPage(page: Page<Template> | undefined) {
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
