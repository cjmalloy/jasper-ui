import { Component, computed, effect, inject, input, untracked, ViewEncapsulation } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
import { isEqual } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { gridTemplate } from '../../mods/org/grid';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { hasTag, repost } from '../../util/tag';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { GridCellComponent } from './grid-cell/grid-cell.component';

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    'class': 'grid ext',
    '[attr.data-theme-version]': 'themeVersion()',
  },
  imports: [
    AgGridModule,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class GridComponent implements HasChanges {
  store = inject(Store);
  private admin = inject(AdminService);
  private refs = inject(RefService);
  private router = inject(Router);

  private customTypes = new Set<string>(['url', 'tag', 'tags', 'sources', 'image', 'lens', 'markdown', 'embed']);
  private autoHeightTypes = new Set<string>(['tags', 'sources', 'image', 'lens', 'markdown', 'embed']);
  readonly rowData = toSignal(toObservable(computed(() => this.page()?.content || [])).pipe(
    switchMap(content => !content.some(ref => this.isBareRepost(ref))
      ? of(content) : forkJoin(content.map(ref => this.getBareRepost(ref)))),
  ), { initialValue: [] as Ref[] });
  readonly themeVersion = computed(() => this.store.darkTheme() ? 1 : 0);

  readonly tag = input('');
  readonly ext = input<Ext | undefined>();
  readonly pageControls = input(true);
  readonly emptyMessage = input('No results found');

  readonly defaultCols = computed<ColDef[]>(() => this.admin.getTemplate('grid')?.defaults?.columnDefs || gridTemplate.defaults.columnDefs);

  readonly page = input<Page<Ref> | undefined>();
  readonly colsInput = input<number | undefined>(undefined, { alias: 'cols' });

  constructor() {
    ModuleRegistry.registerModules([ AllCommunityModule ]);
    effect(() => {
      const value = this.page();
      untracked(() => this.updatePage(value));
    });
  }

  saveChanges() {
    return true;
  }

  readonly columnDefs = computed<ColDef[]>(() => {
    return this.applyFormatters(this.ext()?.config?.columnDefs || this.defaultCols());
  }, { equal: isEqual });

  applyFormatters(cols: ColDef[]): ColDef[] {
    return cols.map(col => {
      const type = col.type as string | undefined;
      if (type && this.customTypes.has(type)) {
        return {
          ...col,
          cellRenderer: col.cellRenderer || GridCellComponent,
          autoHeight: col.autoHeight ?? this.autoHeightTypes.has(type),
          wrapText: col.wrapText ?? this.autoHeightTypes.has(type),
        };
      }
      if (type === 'date') {
        return { ...col, filter: col.filter || 'agDateColumnFilter', valueFormatter: params => this.formatDate(params.value, DateTime.DATE_SHORT) };
      }
      if (type === 'dateTime') {
        return { ...col, filter: col.filter || 'agDateColumnFilter', valueFormatter: params => this.formatDate(params.value, DateTime.DATETIME_SHORT) };
      }
      if (type === 'dateString') {
        return { ...col, filter: col.filter || 'agDateColumnFilter', valueFormatter: params => this.formatDateString(params.value, DateTime.DATE_SHORT) };
      }
      if (type === 'dateTimeString') {
        return { ...col, filter: col.filter || 'agDateColumnFilter', valueFormatter: params => this.formatDateString(params.value, DateTime.DATETIME_SHORT) };
      }
      return col;
    });
  }

  formatDate(value: unknown, format: Intl.DateTimeFormatOptions = DateTime.DATETIME_SHORT): string {
    return DateTime.isDateTime(value) ? value.toLocaleString(format) : '';
  }

  formatDateString(value: unknown, format: Intl.DateTimeFormatOptions = DateTime.DATETIME_SHORT): string {
    if (typeof value !== 'string') return '';
    const dt = DateTime.fromISO(value);
    return dt.isValid ? dt.toLocaleString(format) : '';
  }

  private updatePage(value: Page<Ref> | undefined) {
    if (value) {
      if (value.page.number > 0 && value.page.number >= value.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: value.page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
    }
  }

  private getBareRepost(ref: Ref) {
    if (!this.isBareRepost(ref)) return of(ref);
    const source = repost(ref);
    const top = this.store.view.top();
    return (top?.url === source
        ? of(top)
        : this.refs.getCurrent(source)
    ).pipe(
      catchError(() => of(ref)),
    );
  }

  private isBareRepost(ref: Ref) {
    return !!ref.sources?.[0] && hasTag('plugin/repost', ref) && !ref.title && !ref.comment;
  }

  readonly cols = computed(() => {
    if (this.colsInput()) return this.colsInput();
    return this.ext()?.config?.defaultCols;
  });
}
