import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Page } from '../../model/page';
import { Store } from '../../store/store';

@Component({
  selector: 'app-page-controls',
  templateUrl: './page-controls.component.html',
  styleUrls: ['./page-controls.component.scss'],
})
export class PageControlsComponent implements OnInit {
  @HostBinding('class') css = 'page-controls';

  @Input()
  page!: Page<any>;

  constructor(
    private store: Store,
    private router: Router,
  ) { }


  @HostBinding('class.print-hide')
  get fullResults() {
    return this.page.totalPages === 1;
  }

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

  get pageSize() {
    return this.store.view.pageSize;
  }

  set pageSize(value: number) {
    this.router.navigate([], { queryParams: { pageSize: value }, queryParamsHandling: 'merge' });
  }

  ngOnInit(): void {
  }

  scrollUp() {
    window.scrollTo(0, 0);
  }
}
