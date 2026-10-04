import { computed, Component, forwardRef, signal, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Ref } from '../../../model/ref';
import { isInlineSvg } from '../../../pipe/thumbnail.pipe';
import { AdminService } from '../../../service/admin.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { MdComponent } from '../../md/md.component';
import { NavComponent } from '../../nav/nav.component';
import { ViewerComponent } from '../../viewer/viewer.component';

@Component({
  selector: 'app-grid-cell',
  templateUrl: './grid-cell.component.html',
  styleUrl: './grid-cell.component.scss',
  imports: [
    forwardRef(() => MdComponent),
    forwardRef(() => NavComponent),
    forwardRef(() => ViewerComponent),
  ],
})
export class GridCellComponent implements ICellRendererAngularComp {
  private admin = inject(AdminService);
  private proxy = inject(ProxyService);
  private sanitizer = inject(DomSanitizer);

  readonly type = signal('');
  readonly value = signal<unknown>(undefined);
  private readonly data = signal<Ref | undefined>(undefined);

  agInit(params: ICellRendererParams): void {
    this.value.set(params.value);
    this.data.set(params.data ? { ...params.data } : undefined);
    const type = params.colDef?.type;
    this.type.set(typeof type === 'string' ? type : '');
  }

  refresh(params: ICellRendererParams): boolean {
    this.agInit(params);
    return true;
  }

  readonly textValue = computed(() => {
    const value = this.value();
    return typeof value === 'string' ? value : '';
  });

  readonly listValue = computed(() => {
    const value = this.value();
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item) : [];
  });

  readonly displayValue = computed(() => {
    if (Array.isArray(this.value())) {
      return this.listValue().join(', ');
    }
    return this.textValue();
  });

  readonly imageUrl = computed(() => {
    const url = this.textValue();
    if (!url) return '';
    if (isInlineSvg(url)) return this.sanitizer.bypassSecurityTrustUrl(url);
    if (!this.admin.getPlugin('plugin/image')) return '';
    if (url.startsWith('cache:') || this.admin.getPlugin('plugin/image')?.config?.proxy) {
      return this.proxy.getFetch(url, this.data()?.origin || '', this.data()?.title || $localize`Untitled Image`);
    }
    return url;
  });

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
