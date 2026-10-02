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
  readonly ext = input<Ext | undefined>(undefined);
  readonly page = input<Page<Ref> | undefined>(undefined);

  readonly pinned = signal<Ref[]>([]);
  error: any;


  readonly list = viewChildren(BlogEntryComponent);

  constructor(
    private router: Router,
    private store: Store,
    private refs: RefService,
  ) {
    effect(() => {
      const value = this.ext();
      if (!value?.config?.pinned?.length) {
        this.pinned.set([]);
      } else {
        forkJoin((value.config.pinned as string[])
          .map(pin => this.refs.getCurrent(pin).pipe(
            catchError(err => of({url: pin})),
            takeUntilDestroyed(this.destroyRef),
          )))
          .subscribe(pinned => this.pinned.set(pinned));
      }
    });
    effect(() => {
      const page = this.page();
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


  get cols() {
    const cols = this.colsInput();
    if (cols) return cols;
    return this.config?.defaultCols;
  }

  get colStyle() {
    return this.cols ? ' 1fr'.repeat(this.cols) : '';
  }


  get config() {
    return this.ext()?.config as RootConfig | undefined;
  }

}
