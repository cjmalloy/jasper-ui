import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Ref } from '../../model/ref';
import { MdComponent } from '../md/md.component';
import { NavComponent } from '../nav/nav.component';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-grid-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MdComponent,
    NavComponent,
    ViewerComponent,
  ],
  styles: `
    :host {
      display: block;
    }

    .grid-cell {
      display: block;
      padding-block: 0.25rem;
    }

    .grid-list {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .grid-link,
    .grid-tag {
      overflow-wrap: anywhere;
    }

    .grid-markdown,
    .grid-viewer {
      display: block;
      max-width: min(24rem, 100%);
      overflow: hidden;
    }
  `,
  template: `
    <div class="grid-cell">
      @if (type === 'url' && textValue) {
        <app-nav class="grid-link"
                 [url]="textValue"
                 [text]="textValue"></app-nav>
      } @else if (type === 'tag' && textValue) {
        <app-nav class="grid-tag"
                 [url]="tagUrl(textValue)"></app-nav>
      } @else if (type === 'tags' && listValue.length) {
        <div class="grid-list">
          @for (tag of listValue; track tag) {
            <app-nav class="grid-tag"
                     [url]="tagUrl(tag)"></app-nav>
          }
        </div>
      } @else if (type === 'sources' && listValue.length) {
        <div class="grid-list">
          @for (source of listValue; track source) {
            <app-nav class="grid-link"
                     [url]="source"
                     [text]="source"></app-nav>
          }
        </div>
      } @else if (type === 'image' && textValue) {
        <app-viewer class="grid-viewer"
                    [ref]="viewerRef('plugin/image', textValue)"
                    [disableResize]="true"></app-viewer>
      } @else if (type === 'lens' && textValue) {
        <app-viewer class="grid-viewer"
                    [ref]="viewerRef('plugin/lens', tagUrl(textValue))"
                    [disableResize]="true"></app-viewer>
      } @else if (type === 'markdown' && textValue) {
        <app-md class="grid-markdown"
                [text]="textValue"
                [clipboard]="false"
                [mermaid]="false"></app-md>
      } @else if (type === 'embed' && textValue) {
        <app-viewer class="grid-viewer"
                    [ref]="viewerRef('plugin/embed', textValue)"
                    [disableResize]="true"></app-viewer>
      } @else {
        {{ displayValue }}
      }
    </div>
  `,
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
    return 'tag:/' + tag;
  }

  viewerRef(tag: string, url: string): Ref {
    return { url, tags: [tag] } as Ref;
  }
}
