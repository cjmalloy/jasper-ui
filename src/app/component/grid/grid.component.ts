import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  ViewEncapsulation
} from '@angular/core';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry } from 'ag-grid-community';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, forkJoin, of, Subject, takeUntil, throwError } from 'rxjs';
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
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();
  private rowDataVersion = 0;

  @Input()
  tag = '';
  @Input()
  ext?: Ext;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';

  defaultCols: ColDef[] = this.admin.getTemplate('grid')?.defaults?.columnDefs || gridTemplate.defaults.columnDefs;
  rowData: Ref[] = [];

  private _page?: Page<Ref>;
  private _cols = 0;

  constructor(
    public store: Store,
    private admin: AdminService,
    private refs: RefService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {
    ModuleRegistry.registerModules([ AllCommunityModule ]);
    this.disposers.push(autorun(() => {
      // Access the observable to subscribe
      this.store.darkTheme;
      this.cd.markForCheck();
    }));
  }

  saveChanges() {
    return true;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
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
    this.updateRowData(value?.content || []);
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

  private updateRowData(content: Ref[]) {
    const version = ++this.rowDataVersion;
    this.rowData = content;
    const fetches = content.map(ref => this.getBareRepost(ref));
    if (!fetches.some((fetch, index) => fetch !== content[index])) return;
    forkJoin(fetches).pipe(
      takeUntil(this.destroy$),
    ).subscribe(rowData => {
      if (version !== this.rowDataVersion) return;
      this.rowData = rowData;
      this.cd.markForCheck();
    });
  }

  private getBareRepost(ref: Ref) {
    if (!this.isBareRepost(ref)) return of(ref);
    const source = repost(ref);
    return (this.store.view.top?.url === source
        ? of(this.store.view.top)
        : this.refs.getCurrent(source)
    ).pipe(
      catchError(err => err.status === 404 ? of(ref) : throwError(() => err)),
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
