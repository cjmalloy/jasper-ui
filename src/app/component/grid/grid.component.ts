import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { GridCellComponent } from './grid-cell/grid-cell.component';

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'grid ext' },
  imports: [
    AgGridModule,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class GridComponent implements OnDestroy {
  private customTypes = new Set<string>(['url', 'tag', 'tags', 'sources', 'image', 'lens', 'markdown', 'embed']);
  private autoHeightTypes = new Set<string>(['tags', 'sources', 'image', 'lens', 'markdown', 'embed']);
  private disposers: IReactionDisposer[] = [];

  @Input()
  tag = '';
  @Input()
  ext?: Ext;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';

  defaultCols: ColDef[] = this.admin.getTemplate('grid')?.defaults?.columnDefs || [
    // { checkboxSelection: true },
    { headerName: $localize`Title`, field: 'title', editable: true },
    { headerName: $localize`Tags`, field: 'tags' },
    { headerName: $localize`Responses`, field: 'metadata.responses' },
    { headerName: $localize`Comments`,  field: 'metadata.comments' },
    { headerName: $localize`Published`, field: 'published', type: 'dateTime' },
  ];

  private _page?: Page<Ref>;
  private _cols = 0;

  constructor(
    public store: Store,
    private admin: AdminService,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) {
    this.disposers.push(autorun(() => {
      // Access the observable to subscribe
      this.store.darkTheme;
      this.cd.markForCheck();
    }));
  }

  ngOnDestroy() {
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

  @Input()
  set cols(value: number | undefined) {
    this._cols = value || 0;
  }

  get cols() {
    if (this._cols) return this._cols;
    return this.ext?.config?.defaultCols;
  }
}
