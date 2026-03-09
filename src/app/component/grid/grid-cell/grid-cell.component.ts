import { ChangeDetectionStrategy, Component, forwardRef } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { MdComponent } from '../../md/md.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';

@Component({
  selector: 'app-grid-cell',
  templateUrl: './grid-cell.component.html',
  styleUrl: './grid-cell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => MdComponent),
    forwardRef(() => NavComponent),
    forwardRef(() => ViewerComponent),
  ],
})
export class GridCellComponent implements ICellRendererAngularComp {
  type = '';
  value?: unknown;
  private data?: Ref;

  constructor(
    private admin: AdminService,
    private proxy: ProxyService,
  ) {}

  agInit(params: ICellRendererParams): void {
    this.value = params.value;
    this.data = params.data;
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

  get imageUrl() {
    const url = this.textValue;
    if (!url) return '';
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy) {
      return this.proxy.getFetch(url, this.data?.origin || '', this.data?.title || $localize`Untitled Image`);
    }
    return url;
  }

  tagUrl(tag: string) {
    return `tag:/${tag}`;
  }

  viewerRef(tag: string, url: string): Ref {
    return {
      url,
      origin: '',
      tags: [tag],
      modifiedString: url,
    };
  }
}
