import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Page } from '../../model/page';

@Component({
  selector: 'app-page-controls',
  templateUrl: './page-controls.component.html',
  styleUrls: ['./page-controls.component.scss'],
})
export class PageControlsComponent implements OnInit {
  @HostBinding('class') css = 'page-controls';

  @Input()
  page!: Page<any>;

  constructor() { }

  get hasQuery() {
    return !!window.location.search;
  }

  get prev() {
    return Math.max(0, this.page.number - 1);
  }

  get next() {
    return Math.max(0, Math.min(this.last, this.page.number + 1));
  }

  get last() {
    return Math.max(0, this.page.totalPages - 1);
  }

  ngOnInit(): void {
  }

}
