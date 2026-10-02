import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostBinding,
  Input,
  OnDestroy,
  signal,
  ViewEncapsulation,
  input
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
import { DateTime } from 'luxon';
import { catchError, forkJoin, of, Subject, switchMap } from 'rxjs';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'grid ext' },
  imports: [
    AgGridModule,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class GridComponent implements OnDestroy, HasChanges {
  private customTypes = new Set<string>(['url', 'tag', 'tags', 'sources', 'image', 'lens', 'markdown', 'embed']);
  private autoHeightTypes = new Set<string>(['tags', 'sources', 'image', 'lens', 'markdown', 'embed']);
  private rowDataUpdates$ = new Subject<Ref[]>();
  private readonly _rowData = signal<Ref[]>([]);
  private readonly _themeVersion = signal(0);
  private themeVersionCount = 0;

  @HostBinding('attr.data-theme-version')
  get themeVersion() { return this._themeVersion(); }

  readonly tag = input('');
  @Input()
  ext?: Ext;
  readonly pageControls = input(true);
  @Input()
  emptyMessage = 'No results found';

  defaultCols: ColDef[] = this.admin.getTemplate('grid')?.defaults?.columnDefs || gridTemplate.defaults.columnDefs;
  get rowData() { return this._rowData(); }
  set rowData(value: Ref[]) { this._rowData.set(value); }

  private _page?: Page<Ref>;
  private _cols = 0;

  constructor(
    public store: Store,
    private admin: AdminService,
    private refs: RefService,
    private router: Router,
  ) {
    ModuleRegistry.registerModules([ AllCommunityModule ]);
    effect(() => {
      this.store.darkTheme;
      this._themeVersion.set(++this.themeVersionCount);
    });
    this.rowDataUpdates$.pipe(
      switchMap(content => {
        if (!content.some(ref => this.isBareRepost(ref))) return of(content);
        return forkJoin(content.map(ref => this.getBareRepost(ref)));
      }),
      takeUntilDestroyed(),
    ).subscribe(rowData => {
      this.rowData = rowData;
    });
  }

  saveChanges() {
    return true;
  }

  ngOnDestroy() {
    this.rowDataUpdates$.complete();
  }

  get columnDefs(): ColDef[] {
    return this.applyFormatters(this.ext?.config?.columnDefs || this.defaultCols);
  }

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

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    this.rowDataUpdates$.next(value?.content || []);
    if (this._page) {
      if (this._page.page.number > 0 && this._page.page.number >= this._page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
    }
  }

  private getBareRepost(ref: Ref) {
    if (!this.isBareRepost(ref)) return of(ref);
    const source = repost(ref);
    return (this.store.view.top?.url === source
        ? of(this.store.view.top)
        : this.refs.getCurrent(source)
    ).pipe(
      catchError(() => of(ref)),
    );
  }

  private isBareRepost(ref: Ref) {
    return !!ref.sources?.[0] && hasTag('plugin/repost', ref) && !ref.title && !ref.comment;
  }

  @Input()
  set cols(value: number | undefined) {
    this._cols = value || 0;
  }

  get cols() {
    if (this._cols) return this._cols;
    return this.ext?.config?.defaultCols;
  }
}
