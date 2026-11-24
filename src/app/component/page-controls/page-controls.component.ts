import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { delay } from 'lodash-es';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { BookmarkService } from '../../service/bookmark.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { cursorPage, plainClick } from '../../util/cursor-page';

@Component({
  selector: 'app-page-controls',
  templateUrl: './page-controls.component.html',
  styleUrls: ['./page-controls.component.scss'],
  host: {
    'class': 'page-controls',
    '[class.print-hide]': "fullResults()",
  },
  imports: [
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    FormsModule,
  ]
})
export class PageControlsComponent {
  store = inject(Store);
  private bookmarks = inject(BookmarkService);
  private query = inject(QueryStore);
  private refs = inject(RefService);


  readonly page = input<Page<any> | undefined>();
  readonly showPageLast = input(true);
  readonly hideCols = input(false);
  readonly showPrev = input(true);
  /**
   * Only show the column selector, since infinite scroll loads more pages.
   */
  readonly infinite = input(false);

  pageSizes = [6, 24, 48, 96, 480];
  colSizes = [1, 2, 3, 4, 5, 6];
  readonly colsChanged = linkedSignal(() => this.defaultCols() !== undefined || !!this.store.view.cols());

  readonly fullResults = computed(() => {
    return this.page()?.page.totalPages === 1;
  });

  readonly defaultCols = input<number | undefined>();

  readonly hasQuery = computed(() => {
    return this.store.view.pageNumber() !== undefined;
  });

  readonly prev = computed(() => {
    return Math.max(0, this.page()!.page.number - 1);
  });

  readonly next = computed(() => {
    return Math.max(0, Math.min(this.last(), this.page()!.page.number + 1));
  });

  readonly last = computed(() => {
    return Math.max(0, this.page()!.page.totalPages - 1);
  });

  readonly pageSize = computed(() => this.store.view.pageSize());
  setPageSize(value: number) {
    this.bookmarks.setPageSize(value);
  }

  readonly cols = computed(() => this.store.view.cols());
  setCols(value: number) {
    this.bookmarks.cols = value;
  }

  scrollUp() {
    delay(() => window.scrollTo(0, 0), 400);
  }

  cursorPage(target: number, event?: MouseEvent) {
    if (!plainClick(event)) return;

    const page = this.currentPage();
    const args = this.query.args();
    if (!page || !args) return;

    const request = cursorPage(this.refs, page, args, target);
    if (request) this.query.queueCursorPage(target, request);
  }

  outOfPageSizeRange(size: number) {
    return !this.pageSizes.includes(size);
  }

  outOfColSizeRange(size: number) {
    return !this.colSizes.includes(size);
  }

  private currentPage(): Page<Ref> | undefined {
    const page = this.page() as Page<Ref> | undefined;
    if (!page || page !== this.query.page() || page.content.length === 0) return undefined;
    return page;
  }
}
