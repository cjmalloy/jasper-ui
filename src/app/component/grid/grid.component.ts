import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { DateTime } from 'luxon';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
  imports: [
    AgGridModule,
    PageControlsComponent,
    LoadingComponent,
  ],
})
export class GridComponent {

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
    { headerName: $localize`Published`,  field: 'published' },
  ];

  private _page?: Page<Ref>;
  private _cols = 0;

  constructor(
    public store: Store,
    private admin: AdminService,
    private router: Router,
  ) { }

  get columnDefs(): ColDef[] {
    return this.applyFormatters(this.ext?.config?.columnDefs || this.defaultCols);
  }

  applyFormatters(cols: ColDef[]): ColDef[] {
    return cols.map(col => col.field === 'published'
      ? { ...col, filter: col.filter || 'agDateColumnFilter', valueFormatter: params => this.formatDate(params.value) }
      : col);
  }

  formatDate(value: unknown): string {
    return value instanceof DateTime ? value.toLocaleString(DateTime.DATETIME_SHORT) : '';
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
