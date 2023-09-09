import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Page } from '../../model/page';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-page-controls',
  templateUrl: './page-controls.component.html',
  styleUrls: ['./page-controls.component.scss'],
})
export class PageControlsComponent implements OnInit {
  @HostBinding('class') css = 'page-controls';

  @Input()
  page?: Page<any>;
  @Input()
  showPageLast = true;
  @Input()
  hideCols = false;

  pageSizes = [6, 24, 48, 96, 480];
  colSizes = [1, 2, 3, 4, 5, 6];
  colsChanged = false;

  constructor(
    public store: Store,
    private bookmarks: BookmarkService,
  ) { }

  @HostBinding('class.print-hide')
  get fullResults() {
    return this.page?.totalPages === 1;
  }

  @Input()
  set defaultCols(value: number | undefined) {
    this.colsChanged ||= value !== undefined;
  }

  get hasQuery() {
    return this.store.view.pageNumber !== undefined;
  }

  get prev() {
    return Math.max(0, this.page!.number - 1);
  }

  get next() {
    return Math.max(0, Math.min(this.last, this.page!.number + 1));
  }

  get last() {
    return Math.max(0, this.page!.totalPages - 1);
  }

  get pageSize() {
    return this.store.view.pageSize;
  }

  set pageSize(value: number) {
    this.bookmarks.pageSize = value;
  }

  get cols() {
    if (this.store.view.cols) {
      this.colsChanged = true;
    }
    return this.store.view.cols;
  }

  set cols(value: number) {
    this.bookmarks.cols = value;
  }

  ngOnInit(): void {
  }

  scrollUp() {
    window.scrollTo(0, 0);
  }

  outOfPageSizeRange(size: number) {
    return !this.pageSizes.includes(size);
  }

  outOfColSizeRange(size: number) {
    return !this.colSizes.includes(size);
  }
}
