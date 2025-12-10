import { Component, HostBinding, Input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { delay, without } from 'lodash-es';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';
import { UrlFilter } from '../../util/query';

@Component({
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
    private router: Router,
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

  /**
   * Get the primary sort field (without direction suffix).
   */
  get primarySort(): string {
    const sort = this.store.view.sort;
    if (!sort?.length) return '';
    const first = Array.isArray(sort) ? sort[0] : sort;
    if (!first) return '';
    // Remove direction suffix (,ASC or ,DESC)
    return first.split(',')[0];
  }

  /**
   * Get the sort direction for the primary sort.
   */
  get sortDirection(): 'ASC' | 'DESC' {
    const sort = this.store.view.sort;
    if (!sort?.length) return 'DESC';
    const first = Array.isArray(sort) ? sort[0] : sort;
    if (!first) return 'DESC';
    if (first.includes(',')) {
      return first.split(',')[1].toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    }
    // Default to DESC for date fields
    return 'DESC';
  }

  /**
   * Check if cursor-based pagination should be used.
   * This is true when sorting by modified, created, or published.
   */
  get useCursor(): boolean {
    const sort = this.primarySort;
    return ['modified', 'created', 'published'].includes(sort);
  }

  /**
   * Get the timestamp from a Ref based on the current sort field.
   */
  private getTimestamp(ref: Ref): string | undefined {
    const sort = this.primarySort;
    switch (sort) {
      case 'modified':
        return ref.modifiedString || ref.modified?.toISO() || undefined;
      case 'created':
        return ref.created?.toISO() || undefined;
      case 'published':
        return ref.published?.toISO() || undefined;
      default:
        return undefined;
    }
  }

  /**
   * Get the filter prefix for the current sort field.
   */
  private getFilterPrefix(): string {
    return this.primarySort; // 'modified', 'created', or 'published'
  }

  /**
   * Remove any existing cursor filters for the current sort field.
   */
  private cleanCursorFilters(): string[] {
    const prefix = this.getFilterPrefix();
    const existingFilters = this.store.view.filter || [];
    return without(
      existingFilters,
      ...existingFilters.filter(f =>
        f.startsWith(`${prefix}/before/`) || f.startsWith(`${prefix}/after/`)
      )
    );
  }

  /**
   * Navigate to the next page using cursor-based pagination.
   */
  navigateNext() {
    if (!this.useCursor || !this.page?.content?.length) {
      // Fall back to regular pagination
      this.router.navigate([], {
        queryParams: { pageNumber: this.next },
        queryParamsHandling: 'merge',
      });
      this.scrollUp();
      return;
    }

    // Get the last item's timestamp for cursor
    const lastItem = this.page.content[this.page.content.length - 1] as Ref;
    const timestamp = this.getTimestamp(lastItem);
    if (!timestamp) {
      // Fall back to regular pagination
      this.router.navigate([], {
        queryParams: { pageNumber: this.next },
        queryParamsHandling: 'merge',
      });
      this.scrollUp();
      return;
    }

    const prefix = this.getFilterPrefix();
    const isDesc = this.sortDirection === 'DESC';

    // For DESC order: use "before" filter to get older items
    // For ASC order: use "after" filter to get newer items
    const filterType = isDesc ? 'before' : 'after';
    const newFilter = `${prefix}/${filterType}/${timestamp}` as UrlFilter;

    // Remove any existing cursor filters for this sort field and add the new one
    const cleanedFilters = this.cleanCursorFilters();

    this.router.navigate([], {
      queryParams: {
        filter: [...cleanedFilters, newFilter],
        pageNumber: null,
      },
      queryParamsHandling: 'merge',
    });
    this.scrollUp();
  }

  /**
   * Navigate to the previous page using cursor-based pagination.
   */
  navigatePrev() {
    if (!this.useCursor || !this.page?.content?.length) {
      // Fall back to regular pagination
      this.router.navigate([], {
        queryParams: { pageNumber: this.prev },
        queryParamsHandling: 'merge',
      });
      return;
    }

    // Get the first item's timestamp for cursor
    const firstItem = this.page.content[0] as Ref;
    const timestamp = this.getTimestamp(firstItem);
    if (!timestamp) {
      // Fall back to regular pagination
      this.router.navigate([], {
        queryParams: { pageNumber: this.prev },
        queryParamsHandling: 'merge',
      });
      return;
    }

    const prefix = this.getFilterPrefix();
    const isDesc = this.sortDirection === 'DESC';

    // For DESC order: use "after" filter to get newer items
    // For ASC order: use "before" filter to get older items
    const filterType = isDesc ? 'after' : 'before';
    const newFilter = `${prefix}/${filterType}/${timestamp}` as UrlFilter;

    // Remove any existing cursor filters for this sort field and add the new one
    const cleanedFilters = this.cleanCursorFilters();

    this.router.navigate([], {
      queryParams: {
        filter: [...cleanedFilters, newFilter],
        pageNumber: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Navigate to the first page (remove cursor filters).
   */
  navigateFirst() {
    if (!this.useCursor) {
      // Fall back to regular pagination
      this.router.navigate([], {
        queryParams: { pageNumber: this.store.view.defaultPageNumber ? 0 : null },
        queryParamsHandling: 'merge',
      });
      return;
    }

    const cleanedFilters = this.cleanCursorFilters();

    this.router.navigate([], {
      queryParams: {
        filter: cleanedFilters.length ? cleanedFilters : null,
        pageNumber: null,
      },
      queryParamsHandling: 'merge',
    });
  }
}
