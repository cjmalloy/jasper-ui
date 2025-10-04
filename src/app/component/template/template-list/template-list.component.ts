import { Component, Input, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Template } from '../../../model/template';
import { TemplateComponent } from '../template.component';

@Component({
  standalone: false,
  selector: 'app-template-list',
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.scss'],
  host: {'class': 'template-list'}
})
export class TemplateListComponent implements HasChanges {

  @ViewChildren(TemplateComponent)
  list?: QueryList<TemplateComponent>;

  private _page?: Page<Template>;

  constructor(private router: Router) { }

  saveChanges() {
    return !this.list?.find(p => !p.saveChanges());
  }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<Template> | undefined) {
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
