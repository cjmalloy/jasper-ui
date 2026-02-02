import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { delay } from 'lodash-es';
import { Page } from '../../model/page';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-page-controls',
  templateUrl: './page-controls.component.html',
  styleUrls: ['./page-controls.component.scss'],
  host: { 'class': 'page-controls' },
  imports: [
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    FormsModule,
  ]
})
export class PageControlsComponent {

  @Input()
  page?: Page<any>;
  @Input()
  showPageLast = true;
  @Input()
  hideCols = false;
  @Input()
  showPrev = true;

  pageSizes = [6, 24, 48, 96, 480];
  colSizes = [1, 2, 3, 4, 5, 6];
  colsChanged = false;

  constructor(
    public store: Store,
    private bookmarks: BookmarkService,
  ) { }

  @HostBinding('class.print-hide')
  get fullResults() {
    return this.page?.page.totalPages === 1;
  }

  @Input()
  set defaultCols(value: number | undefined) {
    this.colsChanged ||= value !== undefined;
  }

  get hasQuery() {
    return this.store.view.pageNumber !== undefined;
  }

  get prev() {
    return Math.max(0, this.page!.page.number - 1);
  }

  get next() {
    return Math.max(0, Math.min(this.last, this.page!.page.number + 1));
  }

  get last() {
    return Math.max(0, this.page!.page.totalPages - 1);
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

  scrollUp() {
    delay(() => window.scrollTo(0, 0), 400);
  }

  outOfPageSizeRange(size: number) {
    return !this.pageSizes.includes(size);
  }

  outOfColSizeRange(size: number) {
    return !this.colSizes.includes(size);
  }
}
