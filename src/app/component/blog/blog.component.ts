import { Component, computed, effect, inject, input, viewChildren } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
  imports: [
    BlogEntryComponent,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class BlogComponent implements HasChanges {
  private router = inject(Router);
  private store = inject(Store);
  private refs = inject(RefService);

  readonly pageControls = input(true);
  readonly emptyMessage = input($localize `No blog entries found`);
  readonly colsInput = input<number | undefined>(undefined, { alias: 'cols' });
  readonly ext = input<Ext | undefined>(undefined);
  readonly page = input<Page<Ref> | undefined>(undefined);

  private readonly pinnedResource = rxResource({
    params: () => this.ext()?.config?.pinned as string[] | undefined,
    stream: ({ params }) => params?.length
      ? forkJoin(params.map(pin => this.refs.getCurrent(pin).pipe(catchError(() => of<Ref>({ url: pin })))))
      : of([]),
    defaultValue: [] as Ref[],
  });
  readonly pinned = computed(() => this.pinnedResource.value());
  error: any;


  readonly list = viewChildren(BlogEntryComponent);

  constructor() {
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


  readonly cols = computed(() => {
    const cols = this.colsInput();
    if (cols) return cols;
    return this.config()?.defaultCols;
  });

  readonly colStyle = computed(() => {
    const cols = this.cols();
    return cols ? ' 1fr'.repeat(cols) : '';
  });


  readonly config = computed(() => {
    return this.ext()?.config as RootConfig | undefined;
  });

}
