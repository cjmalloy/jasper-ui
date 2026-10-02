import { DestroyRef, inject, Component, ChangeDetectionStrategy, effect, input, signal, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RootConfig } from '../../mods/root';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { BlogEntryComponent } from './blog-entry/blog-entry.component';

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss'],
  host: { 'class': 'blog ext' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlogEntryComponent,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class BlogComponent implements HasChanges {
  private destroyRef = inject(DestroyRef);

  readonly pageControls = input(true);
  readonly emptyMessage = input($localize `No blog entries found`);
  readonly colsInput = input<number | undefined>(undefined, { alias: 'cols' });
  readonly extInput = input<Ext | undefined>(undefined, { alias: 'ext' });
  readonly pageInput = input<Page<Ref> | undefined>(undefined, { alias: 'page' });

  private readonly pinnedSignal = signal<Ref[]>([]);
  error: any;

  get pinned() { return this.pinnedSignal(); }
  set pinned(value: Ref[]) { this.pinnedSignal.set(value); }

  readonly list = viewChildren(BlogEntryComponent);

  constructor(
    private router: Router,
    private store: Store,
    private refs: RefService,
  ) {
    effect(() => {
      const value = this.extInput();
      if (!value?.config?.pinned?.length) {
        this.pinned = [];
      } else {
        forkJoin((value.config.pinned as string[])
          .map(pin => this.refs.getCurrent(pin).pipe(
            catchError(err => of({url: pin})),
            takeUntilDestroyed(this.destroyRef),
          )))
          .subscribe(pinned => this.pinned = pinned);
      }
    });
    effect(() => {
      const page = this.pageInput();
      if (page?.page.number && page.page.number >= page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: page.page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
    });
  }


  saveChanges() {
    return !this.list()?.find(r => !r.saveChanges());
  }

  get page(): Page<Ref> | undefined {
    return this.pageInput();
  }

  get cols() {
    const cols = this.colsInput();
    if (cols) return cols;
    return this.config?.defaultCols;
  }

  get colStyle() {
    return this.cols ? ' 1fr'.repeat(this.cols) : '';
  }

  get ext() {
    return this.extInput();
  }

  get config() {
    return this.ext?.config as RootConfig | undefined;
  }

}
