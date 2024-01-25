import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ColDef } from 'ag-grid-community';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss'
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

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    this._page = value;
    if (this._page) {
      if (this._page.number > 0 && this._page.number >= this._page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.totalPages - 1
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
