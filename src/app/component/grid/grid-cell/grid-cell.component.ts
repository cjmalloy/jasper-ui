import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Ref } from '../../../model/ref';
import { MdComponent } from '../../md/md.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';

@Component({
  selector: 'app-grid-cell',
  templateUrl: './grid-cell.component.html',
  styleUrl: './grid-cell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdComponent,
    NavComponent,
    ViewerComponent,
  ],
})
export class GridCellComponent implements ICellRendererAngularComp {
  type = '';
  value?: unknown;

  agInit(params: ICellRendererParams): void {
    this.value = params.value;
    const type = params.colDef?.type;
    this.type = typeof type === 'string' ? type : '';
  }

  refresh(params: ICellRendererParams): boolean {
    this.agInit(params);
    return true;
  }

  get textValue() {
    return typeof this.value === 'string' ? this.value : '';
  }

  get listValue() {
    return Array.isArray(this.value) ? this.value.filter((value): value is string => typeof value === 'string' && !!value) : [];
  }

  get displayValue() {
    if (Array.isArray(this.value)) {
      return this.listValue.join(', ');
    }
    return this.textValue;
  }

  tagUrl(tag: string) {
    return `tag:/${tag}`;
  }

  viewerRef(tag: string, url: string): Ref {
    return {
      url,
      origin: '',
      tags: [tag],
    };
  }
}
